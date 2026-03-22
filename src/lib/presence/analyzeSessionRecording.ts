import type {
  Classifications,
  Matrix,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

import {
  loadFaceLandmarker,
  resetFaceLandmarker,
} from "@/lib/mediapipe/faceLandmarker";
import {
  accumulatePresenceFrame,
  buildPresenceSessionResult,
  createPresenceAccumulator,
  createUnavailablePresenceResult,
} from "@/lib/scoring/nonVerbalScore";
import type {
  LivePresenceFrame,
  PresenceFaceBounds,
  PresenceHeadAngles,
  PresenceSessionResult,
} from "@/types/presence";
import type { SessionTranscriptEntry } from "../../../lib/voice-feedback/contracts";

const SAMPLE_INTERVAL_MS = 450;
const MODEL_LOAD_TIMEOUT_MS = 20000;
const VIDEO_EVENT_TIMEOUT_MS = 12000;
const VIDEO_FRAME_EPSILON_SECONDS = 0.05;

type SpeakingWindow = {
  endMs: number;
  startMs: number;
};

type AnalyzeSessionRecordingOptions = {
  analysisEndTimestamp?: number | null;
  analysisStartTimestamp?: number | null;
  sessionStartTimestamp?: number | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(
  first: Pick<NormalizedLandmark, "x" | "y">,
  second: Pick<NormalizedLandmark, "x" | "y">,
) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function getLandmark(landmarks: NormalizedLandmark[], index: number) {
  return landmarks[index] ?? null;
}

function getFaceBounds(landmarks: NormalizedLandmark[]): PresenceFaceBounds | null {
  if (landmarks.length === 0) {
    return null;
  }

  const xs = landmarks.map((landmark) => landmark.x);
  const ys = landmarks.map((landmark) => landmark.y);
  const minX = clamp(Math.min(...xs), 0, 1);
  const maxX = clamp(Math.max(...xs), 0, 1);
  const minY = clamp(Math.min(...ys), 0, 1);
  const maxY = clamp(Math.max(...ys), 0, 1);

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY,
  };
}

function getBlendshapeScore(
  blendshapes: Classifications | undefined,
  categoryName: string,
) {
  return (
    blendshapes?.categories.find((category) => category.categoryName === categoryName)
      ?.score ?? 0
  );
}

function hasAngles(angles: PresenceHeadAngles) {
  return (
    angles.pitch !== null &&
    angles.roll !== null &&
    angles.yaw !== null
  );
}

function fallbackHeadAngles(landmarks: NormalizedLandmark[]): PresenceHeadAngles {
  const leftFace = getLandmark(landmarks, 234);
  const rightFace = getLandmark(landmarks, 454);
  const nose = getLandmark(landmarks, 1);
  const leftEyeOuter = getLandmark(landmarks, 33);
  const rightEyeOuter = getLandmark(landmarks, 263);
  const upperLip = getLandmark(landmarks, 13);
  const lowerLip = getLandmark(landmarks, 14);

  if (
    !leftFace ||
    !rightFace ||
    !nose ||
    !leftEyeOuter ||
    !rightEyeOuter ||
    !upperLip ||
    !lowerLip
  ) {
    return {
      pitch: null,
      roll: null,
      yaw: null,
    };
  }

  const leftSpan = Math.abs(nose.x - leftFace.x);
  const rightSpan = Math.abs(rightFace.x - nose.x);
  const yawBalance = (leftSpan - rightSpan) / Math.max(leftSpan + rightSpan, 0.001);
  const eyeMidpointY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
  const mouthMidpointY = (upperLip.y + lowerLip.y) / 2;
  const noseBand = Math.max(mouthMidpointY - eyeMidpointY, 0.001);
  const verticalRatio = (nose.y - eyeMidpointY) / noseBand;
  const rollAngle =
    Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x) *
    (180 / Math.PI);

  return {
    pitch: clamp((0.52 - verticalRatio) * 90, -30, 30),
    roll: clamp(rollAngle, -30, 30),
    yaw: clamp(yawBalance * 55, -35, 35),
  };
}

function extractHeadAngles(
  matrix: Matrix | undefined,
  landmarks: NormalizedLandmark[],
): PresenceHeadAngles {
  const data = matrix?.data;

  if (!data || data.length < 16) {
    return fallbackHeadAngles(landmarks);
  }

  const m00 = data[0];
  const m10 = data[4];
  const m11 = data[5];
  const m12 = data[6];
  const m20 = data[8];
  const m21 = data[9];
  const m22 = data[10];
  const sy = Math.hypot(m00, m10);
  const singular = sy < 1e-6;

  const pitch = singular ? Math.atan2(-m12, m11) : Math.atan2(m21, m22);
  const yaw = Math.atan2(-m20, sy);
  const roll = singular ? 0 : Math.atan2(m10, m00);

  return {
    pitch: clamp((pitch * 180) / Math.PI, -35, 35),
    roll: clamp((roll * 180) / Math.PI, -35, 35),
    yaw: clamp((yaw * 180) / Math.PI, -35, 35),
  };
}

function computeCenterOffset(bounds: PresenceFaceBounds | null) {
  if (!bounds) {
    return null;
  }

  const faceCenterX = bounds.x + bounds.width / 2;
  const faceCenterY = bounds.y + bounds.height / 2;

  return Math.hypot(faceCenterX - 0.5, faceCenterY - 0.48);
}

function computeAttentionScore(
  bounds: PresenceFaceBounds | null,
  angles: PresenceHeadAngles,
) {
  if (!bounds || !hasAngles(angles)) {
    return 0;
  }

  const centerOffset = computeCenterOffset(bounds) ?? 1;
  const yaw = Math.abs(angles.yaw ?? 0);
  const pitch = Math.abs(angles.pitch ?? 0);
  const centerScore = 1 - clamp(centerOffset / 0.2, 0, 1);
  const yawScore = 1 - clamp(yaw / 22, 0, 1);
  const pitchScore = 1 - clamp(pitch / 18, 0, 1);

  return Math.round(((centerScore + yawScore + pitchScore) / 3) * 100);
}

function computeMouthOpenness(
  landmarks: NormalizedLandmark[],
  blendshapes: Classifications | undefined,
) {
  const upperLip = getLandmark(landmarks, 13);
  const lowerLip = getLandmark(landmarks, 14);
  const mouthLeft = getLandmark(landmarks, 61);
  const mouthRight = getLandmark(landmarks, 291);

  if (!upperLip || !lowerLip || !mouthLeft || !mouthRight) {
    return null;
  }

  const mouthGap = distance(upperLip, lowerLip);
  const mouthWidth = Math.max(distance(mouthLeft, mouthRight), 0.001);
  const opennessRatio = mouthGap / mouthWidth;
  const jawOpen = getBlendshapeScore(blendshapes, "jawOpen");

  return Math.max(opennessRatio, jawOpen);
}

function computeHeadStability(
  currentAngles: PresenceHeadAngles,
  previousAngles: PresenceHeadAngles | null,
) {
  if (!previousAngles || !hasAngles(previousAngles) || !hasAngles(currentAngles)) {
    return false;
  }

  const yawDelta = Math.abs((currentAngles.yaw ?? 0) - (previousAngles.yaw ?? 0));
  const pitchDelta = Math.abs(
    (currentAngles.pitch ?? 0) - (previousAngles.pitch ?? 0),
  );
  const rollDelta = Math.abs((currentAngles.roll ?? 0) - (previousAngles.roll ?? 0));

  return (
    yawDelta <= 5 &&
    pitchDelta <= 4 &&
    rollDelta <= 6 &&
    Math.abs(currentAngles.yaw ?? 0) <= 24 &&
    Math.abs(currentAngles.pitch ?? 0) <= 20
  );
}

function buildSpeakingWindows(
  transcript: SessionTranscriptEntry[],
  sessionStartTimestamp: number,
) {
  const sessionStart = sessionStartTimestamp;

  return transcript
    .filter((entry) => entry.role === "user")
    .map((entry, index, userEntries): SpeakingWindow => {
      const nextEntry = userEntries[index + 1];
      const relativeStartMs = Math.max(0, entry.timestamp - sessionStart - 1800);
      const nextRelativeMs = nextEntry
        ? nextEntry.timestamp - sessionStart - 500
        : relativeStartMs + 3200;

      return {
        endMs: Math.max(relativeStartMs + 1600, nextRelativeMs),
        startMs: relativeStartMs,
      };
    });
}

function isWithinSpeakingWindows(
  timestampMs: number,
  windows: SpeakingWindow[],
) {
  return windows.some(
    (window) => timestampMs >= window.startMs && timestampMs <= window.endMs,
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function hasVideoEventSatisfied(
  video: HTMLVideoElement,
  eventName: "loadeddata" | "loadedmetadata" | "seeked",
) {
  if (eventName === "loadedmetadata") {
    return video.readyState >= HTMLMediaElement.HAVE_METADATA;
  }

  if (eventName === "loadeddata") {
    return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  return !video.seeking;
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: "loadeddata" | "loadedmetadata" | "seeked",
) {
  if (hasVideoEventSatisfied(video, eventName)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out while waiting for video event ${eventName}.`));
    }, VIDEO_EVENT_TIMEOUT_MS);

    const handleResolve = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(video.error ?? new Error(`Video event ${eventName} failed.`));
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener(eventName, handleResolve);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener(eventName, handleResolve, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

function waitForRenderedFrame(video: HTMLVideoElement) {
  if (typeof video.requestVideoFrameCallback === "function") {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("Timed out while waiting for the decoded video frame."));
      }, VIDEO_EVENT_TIMEOUT_MS);

      let callbackId: number | null = null;

      const cleanup = () => {
        window.clearTimeout(timeoutId);

        if (
          callbackId !== null &&
          typeof video.cancelVideoFrameCallback === "function"
        ) {
          video.cancelVideoFrameCallback(callbackId);
        }
      };

      callbackId = video.requestVideoFrameCallback(() => {
        cleanup();
        resolve();
      });
    });
  }

  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function prepareVideoFrame(
  video: HTMLVideoElement,
  durationMs: number,
  timestampMs: number,
) {
  const maxSeekSeconds = Math.max(
    0,
    durationMs / 1000 - VIDEO_FRAME_EPSILON_SECONDS,
  );
  const nextTimeSeconds = Math.min(
    maxSeekSeconds,
    Math.max(0, timestampMs / 1000),
  );
  const needsSeek = Math.abs(video.currentTime - nextTimeSeconds) > 0.01;

  if (needsSeek) {
    video.currentTime = nextTimeSeconds;
    await waitForVideoEvent(video, "seeked");
  }

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await waitForVideoEvent(video, "loadeddata");
  }

  await waitForRenderedFrame(video);
}

function buildPresenceFrame(
  landmarks: NormalizedLandmark[],
  blendshapes: Classifications | undefined,
  transformationMatrix: Matrix | undefined,
  timestampMs: number,
  isUserSpeaking: boolean,
  previousHeadAngles: PresenceHeadAngles | null,
  previousMouthOpenness: number | null,
): LivePresenceFrame {
  const faceBounds = getFaceBounds(landmarks);
  const headAngles = extractHeadAngles(transformationMatrix, landmarks);
  const mouthOpenness = computeMouthOpenness(landmarks, blendshapes);
  const attentionScore = computeAttentionScore(faceBounds, headAngles);
  const mouthDelta =
    mouthOpenness !== null && previousMouthOpenness !== null
      ? Math.abs(mouthOpenness - previousMouthOpenness)
      : 0;

  return {
    attentionScore,
    centerOffset: computeCenterOffset(faceBounds),
    faceBounds,
    faceDetected: landmarks.length > 0,
    forwardAttention: attentionScore >= 72,
    headAngles,
    headStable: computeHeadStability(headAngles, previousHeadAngles),
    isUserSpeaking,
    mouthActive:
      isUserSpeaking &&
      mouthOpenness !== null &&
      (mouthOpenness >= 0.16 || mouthDelta >= 0.018),
    mouthOpenness,
    timestampMs,
  };
}

export async function analyzeSessionRecording(
  recordingBlob: Blob,
  transcript: SessionTranscriptEntry[],
  options: AnalyzeSessionRecordingOptions = {},
): Promise<PresenceSessionResult> {
  if (typeof document === "undefined" || recordingBlob.size === 0) {
    return createUnavailablePresenceResult("recording_missing");
  }

  const objectUrl = URL.createObjectURL(recordingBlob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = objectUrl;
  video.load();

  try {
    await waitForVideoEvent(video, "loadedmetadata");

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForVideoEvent(video, "loadeddata");
    }

    const durationMs = Number.isFinite(video.duration)
      ? Math.max(0, Math.round(video.duration * 1000))
      : 0;

    if (durationMs <= 0) {
      return createUnavailablePresenceResult("recording_missing");
    }

    const defaultSessionStartTimestamp =
      transcript.find((entry) => entry.role === "user")?.timestamp ??
      transcript[0]?.timestamp ??
      Date.now();
    const sessionStartTimestamp =
      options.sessionStartTimestamp ?? defaultSessionStartTimestamp;
    const speakingWindows = buildSpeakingWindows(transcript, sessionStartTimestamp);
    const analysisStartMs =
      options.analysisStartTimestamp !== null &&
      options.analysisStartTimestamp !== undefined
        ? Math.max(0, options.analysisStartTimestamp - sessionStartTimestamp - 1800)
        : 0;
    const analysisEndMs =
      options.analysisEndTimestamp !== null &&
      options.analysisEndTimestamp !== undefined
        ? Math.min(
            durationMs,
            Math.max(
              analysisStartMs,
              options.analysisEndTimestamp - sessionStartTimestamp + 1600,
            ),
          )
        : durationMs;
    const accumulator = createPresenceAccumulator();
    let skippedFrameCount = 0;
    let hasRetriedWithCpuLandmarker = false;
    let faceLandmarker;

    try {
      faceLandmarker = await withTimeout(
        loadFaceLandmarker(),
        MODEL_LOAD_TIMEOUT_MS,
        "Timed out while loading the MediaPipe Face Landmarker.",
      );
    } catch (error) {
      console.warn("[voiceforge] MediaPipe Face Landmarker failed to load:", error);
      return createUnavailablePresenceResult("model_load_failed");
    }

    for (
      let timestampMs = analysisStartMs;
      timestampMs <= analysisEndMs;
      timestampMs += SAMPLE_INTERVAL_MS
    ) {
      try {
        await prepareVideoFrame(video, durationMs, timestampMs);
      } catch (error) {
        skippedFrameCount += 1;
        console.warn("[voiceforge] Skipping undecodable video frame:", error);
        continue;
      }

      let result;

      try {
        result = faceLandmarker.detectForVideo(video, timestampMs);
      } catch (error) {
        if (hasRetriedWithCpuLandmarker) {
          skippedFrameCount += 1;
          console.warn("[voiceforge] Skipping frame after repeated MediaPipe detector failure:", error);
          continue;
        }

        try {
          hasRetriedWithCpuLandmarker = true;
          resetFaceLandmarker("GPU");
          faceLandmarker = await withTimeout(
            loadFaceLandmarker("CPU"),
            MODEL_LOAD_TIMEOUT_MS,
            "Timed out while reloading the MediaPipe Face Landmarker on CPU.",
          );
          result = faceLandmarker.detectForVideo(video, timestampMs);
        } catch (retryError) {
          skippedFrameCount += 1;
          console.warn(
            "[voiceforge] Skipping frame after MediaPipe detector retry failed:",
            error,
            retryError,
          );
          continue;
        }
      }

      const landmarks = result.faceLandmarks[0] ?? [];
      const frame = buildPresenceFrame(
        landmarks,
        result.faceBlendshapes[0],
        result.facialTransformationMatrixes[0],
        timestampMs,
        isWithinSpeakingWindows(timestampMs, speakingWindows),
        accumulator.lastHeadAngles,
        accumulator.lastMouthOpenness,
      );

      accumulatePresenceFrame(accumulator, frame);
    }

    if (accumulator.totalFrames === 0 && skippedFrameCount > 0) {
      return createUnavailablePresenceResult("analysis_failed");
    }

    return buildPresenceSessionResult(accumulator);
  } catch (error) {
    console.warn("[voiceforge] Post-session presence analysis failed:", error);
    return createUnavailablePresenceResult("analysis_failed");
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.src = "";
    video.load();
  }
}
