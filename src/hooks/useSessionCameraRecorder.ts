import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

import type { SessionCameraRecording } from "../../lib/voice-feedback/contracts";

export type CameraRecorderStatus =
  | "disabled"
  | "error"
  | "permission-denied"
  | "preview-ready"
  | "recording"
  | "requesting-permission"
  | "unsupported";

type CameraRecordingDraft = {
  blob: Blob;
  recording: SessionCameraRecording;
};

type RecordingMetadata = Pick<
  SessionCameraRecording,
  "hasAudio" | "height" | "width"
>;

type UseSessionCameraRecorderOptions = {
  enabled: boolean;
  isSessionActive: boolean;
  sessionId: string | null;
};

export type UseSessionCameraRecorderResult = {
  finalizeRecording: () => Promise<CameraRecordingDraft | null>;
  hasAudioTrack: boolean;
  isRecording: boolean;
  status: CameraRecorderStatus;
  statusMessage: string;
  streamActive: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
};

const CAMERA_CONSTRAINTS = {
  facingMode: "user",
  height: { ideal: 720 },
  width: { ideal: 1280 },
} as const;

const RECORDING_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

function getSupportedMimeType() {
  return (
    RECORDING_MIME_TYPES.find((mimeType) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType),
    ) ?? ""
  );
}

async function requestCameraStream() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: CAMERA_CONSTRAINTS,
  });
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useSessionCameraRecorder({
  enabled,
  isSessionActive,
  sessionId,
}: UseSessionCameraRecorderOptions): UseSessionCameraRecorderResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingMetadataRef = useRef<RecordingMetadata | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);
  const recorderStartTimeRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const completedRecordingRef = useRef<CameraRecordingDraft | null>(null);
  const stopPromiseRef = useRef<Promise<CameraRecordingDraft | null> | null>(null);
  const resolveStopRef = useRef<((draft: CameraRecordingDraft | null) => void) | null>(
    null,
  );
  const previousSessionActiveRef = useRef(isSessionActive);
  const previousSessionIdRef = useRef(sessionId);

  const [status, setStatus] = useState<CameraRecorderStatus>(
    enabled ? "requesting-permission" : "disabled",
  );
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const releaseRecorder = useCallback(() => {
    mediaRecorderRef.current = null;
    recordingMetadataRef.current = null;
    recorderStartTimeRef.current = null;
    chunksRef.current = [];
    stopPromiseRef.current = null;
    resolveStopRef.current = null;
    setIsRecording(false);
  }, []);

  const finalizeDraft = useCallback(() => {
    const mediaStream = mediaRecorderRef.current?.stream ?? streamRef.current;
    const sessionKey = sessionIdRef.current;
    const videoTrack = mediaStream?.getVideoTracks()[0];
    const settings = videoTrack?.getSettings();
    const recordingMetadata = recordingMetadataRef.current ?? {
      hasAudio: (mediaStream?.getAudioTracks().length ?? 0) > 0,
      height: settings?.height ?? 720,
      width: settings?.width ?? 1280,
    };

    if (!sessionKey || chunksRef.current.length === 0) {
      return null;
    }

    const blob = new Blob(chunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || getSupportedMimeType() || "video/webm",
    });

    if (blob.size === 0) {
      return null;
    }

    const durationMs = Math.max(
      0,
      Math.round(performance.now() - (recorderStartTimeRef.current ?? performance.now())),
    );
    const draft: CameraRecordingDraft = {
      blob,
      recording: {
        durationMs,
        hasAudio: recordingMetadata.hasAudio,
        height: recordingMetadata.height,
        id: sessionKey,
        mimeType: blob.type || "video/webm",
        source: "browser_media_recorder",
        width: recordingMetadata.width,
      },
    };

    completedRecordingRef.current = draft;
    return draft;
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(completedRecordingRef.current);
    }

    if (stopPromiseRef.current) {
      return stopPromiseRef.current;
    }

    stopPromiseRef.current = new Promise<CameraRecordingDraft | null>((resolve) => {
      resolveStopRef.current = resolve;
      recorder.stop();
    });

    return stopPromiseRef.current;
  }, []);

  const resetSessionArtifacts = useCallback(() => {
    completedRecordingRef.current = null;
    chunksRef.current = [];
    recordingMetadataRef.current = null;
    stopPromiseRef.current = null;
    resolveStopRef.current = null;
    recorderStartTimeRef.current = null;
    setIsRecording(false);
  }, []);

  const attachStreamToVideo = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.srcObject = stream;

    try {
      await video.play();
    } catch {
      // Preview may require a second paint in some browsers.
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      const activeStream = streamRef.current;

      void stopRecording().finally(() => {
        stopMediaStream(activeStream);
      });

      streamRef.current = null;
      setHasAudioTrack(false);
      setStatus("disabled");
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("unsupported");
      return undefined;
    }

    let cancelled = false;

    setStatus("requesting-permission");

    void requestCameraStream()
      .catch(async () =>
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: CAMERA_CONSTRAINTS,
        }),
      )
      .then(async (stream) => {
        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;
        setHasAudioTrack(stream.getAudioTracks().length > 0);
        recordingMetadataRef.current = {
          hasAudio: stream.getAudioTracks().length > 0,
          height: stream.getVideoTracks()[0]?.getSettings().height ?? 720,
          width: stream.getVideoTracks()[0]?.getSettings().width ?? 1280,
        };
        await attachStreamToVideo(stream);

        if (cancelled) {
          return;
        }

        setStatus("preview-ready");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof DOMException && error.name === "NotAllowedError") {
          setStatus("permission-denied");
          return;
        }

        setStatus("error");
      });

    return () => {
      cancelled = true;
      const activeStream = streamRef.current;

      void stopRecording().finally(() => {
        stopMediaStream(activeStream);
      });

      streamRef.current = null;
    };
  }, [attachStreamToVideo, enabled, stopRecording]);

  useEffect(() => {
    if (
      !enabled ||
      !isSessionActive ||
      !streamRef.current ||
      !sessionId ||
      status === "permission-denied" ||
      status === "unsupported" ||
      status === "error"
    ) {
      return undefined;
    }

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      return undefined;
    }

    const mimeType = getSupportedMimeType();

    if (!mimeType) {
      setStatus("error");
      return undefined;
    }

    resetSessionArtifacts();
    recordingMetadataRef.current = {
      hasAudio: streamRef.current.getAudioTracks().length > 0,
      height: streamRef.current.getVideoTracks()[0]?.getSettings().height ?? 720,
      width: streamRef.current.getVideoTracks()[0]?.getSettings().width ?? 1280,
    };

    const nextRecorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = nextRecorder;
    chunksRef.current = [];
    recorderStartTimeRef.current = performance.now();

    nextRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    nextRecorder.onstop = () => {
      const draft = finalizeDraft();
      resolveStopRef.current?.(draft);
      resolveStopRef.current = null;
      stopPromiseRef.current = null;
      setIsRecording(false);
      setStatus(enabled ? "preview-ready" : "disabled");
    };

    nextRecorder.onerror = () => {
      resolveStopRef.current?.(completedRecordingRef.current);
      resolveStopRef.current = null;
      stopPromiseRef.current = null;
      setIsRecording(false);
      setStatus("error");
    };

    nextRecorder.start(1000);
    setIsRecording(true);
    setStatus("recording");

    return undefined;
  }, [enabled, finalizeDraft, isSessionActive, resetSessionArtifacts, sessionId, status]);

  useEffect(() => {
    if (!isSessionActive && previousSessionActiveRef.current) {
      void stopRecording();
    }

    previousSessionActiveRef.current = isSessionActive;
  }, [isSessionActive, stopRecording]);

  useEffect(() => {
    if (sessionId !== previousSessionIdRef.current) {
      resetSessionArtifacts();
    }

    previousSessionIdRef.current = sessionId;
  }, [resetSessionArtifacts, sessionId]);

  const finalizeRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      const draft = await stopRecording();
      releaseRecorder();
      return draft;
    }

    const draft = completedRecordingRef.current;
    releaseRecorder();
    return draft;
  }, [releaseRecorder, stopRecording]);

  const statusMessage =
    status === "disabled"
      ? "Camera preview is paused."
      : status === "requesting-permission"
        ? "Requesting camera access for local session recording."
        : status === "permission-denied"
          ? "Camera permission was denied, so post-session video analysis is unavailable."
          : status === "unsupported"
            ? "This browser cannot record the camera stream for post-session analysis."
            : status === "error"
              ? "Camera recording is unavailable right now."
              : status === "recording"
                ? hasAudioTrack
                  ? "Recording camera and voice locally for post-session analysis."
                  : "Recording the camera locally for post-session analysis."
                : hasAudioTrack
                  ? "Camera preview is ready. Recording starts with the session."
                  : "Camera preview is ready. Recording starts with the session, but audio is unavailable.";

  return {
    finalizeRecording,
    hasAudioTrack,
    isRecording,
    status,
    statusMessage,
    streamActive: streamRef.current !== null,
    videoRef,
  };
}
