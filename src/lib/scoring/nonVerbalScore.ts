import type {
  LivePresenceFrame,
  PresenceAccumulator,
  PresenceSessionResult,
  PresenceSummary,
  PresenceUnavailableReason,
} from "@/types/presence";

const SCORE_WEIGHTS = {
  facePresence: 0.35,
  forwardAttention: 0.25,
  headStability: 0.2,
  speakingMouthActivity: 0.2,
} as const;

export const NON_VERBAL_HEURISTICS = [
  "Face presence tracks how often a face stayed visible in the recorded session video.",
  "Forward attention rewards a centered face with low yaw and pitch drift toward the screen.",
  "Head stability rewards small frame-to-frame changes in head angle during visible moments.",
  "Speaking mouth activity checks for mouth movement during transcript-timed user speaking windows.",
] as const;

export const NON_VERBAL_HEURISTIC_NOTE =
  "Post-session video heuristic based on face visibility, forward-facing attention, head steadiness, and mouth movement during your speaking windows.";

export const NON_VERBAL_WEIGHT_NOTE =
  "Weighted 35% face presence, 25% forward attention, 20% head stability, and 20% speaking mouth activity.";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

export function createPresenceAccumulator(): PresenceAccumulator {
  return {
    faceDetectedFrames: 0,
    forwardAttentionFrames: 0,
    headComparableFrames: 0,
    headStableFrames: 0,
    lastHeadAngles: null,
    lastMouthOpenness: null,
    mouthActiveSpeakingFrames: 0,
    speakingFrames: 0,
    totalFrames: 0,
  };
}

export function createEmptyPresenceSummary(): PresenceSummary {
  return {
    faceDetectedFrames: 0,
    facePresencePct: 0,
    forwardAttentionPct: 0,
    headStabilityPct: 0,
    sampledFrames: 0,
    speakingFrames: 0,
    speakingMouthActivityPct: 0,
  };
}

export function accumulatePresenceFrame(
  accumulator: PresenceAccumulator,
  frame: LivePresenceFrame,
) {
  accumulator.totalFrames += 1;

  if (frame.faceDetected) {
    accumulator.faceDetectedFrames += 1;

    if (frame.forwardAttention) {
      accumulator.forwardAttentionFrames += 1;
    }

    const { pitch, roll, yaw } = frame.headAngles;
    const hasComparableAngles =
      pitch !== null &&
      roll !== null &&
      yaw !== null &&
      accumulator.lastHeadAngles?.pitch !== null &&
      accumulator.lastHeadAngles?.roll !== null &&
      accumulator.lastHeadAngles?.yaw !== null;

    if (hasComparableAngles) {
      accumulator.headComparableFrames += 1;

      if (frame.headStable) {
        accumulator.headStableFrames += 1;
      }
    }

    accumulator.lastHeadAngles = frame.headAngles;
    accumulator.lastMouthOpenness = frame.mouthOpenness;
  } else {
    accumulator.lastHeadAngles = null;
    accumulator.lastMouthOpenness = null;
  }

  if (frame.isUserSpeaking) {
    accumulator.speakingFrames += 1;

    if (frame.mouthActive) {
      accumulator.mouthActiveSpeakingFrames += 1;
    }
  }

  return accumulator;
}

export function summarizePresenceAccumulator(
  accumulator: PresenceAccumulator,
): PresenceSummary {
  return {
    faceDetectedFrames: accumulator.faceDetectedFrames,
    facePresencePct: toPercent(
      accumulator.faceDetectedFrames,
      accumulator.totalFrames,
    ),
    forwardAttentionPct: toPercent(
      accumulator.forwardAttentionFrames,
      accumulator.faceDetectedFrames,
    ),
    headStabilityPct: toPercent(
      accumulator.headStableFrames,
      accumulator.headComparableFrames,
    ),
    sampledFrames: accumulator.totalFrames,
    speakingFrames: accumulator.speakingFrames,
    speakingMouthActivityPct: toPercent(
      accumulator.mouthActiveSpeakingFrames,
      accumulator.speakingFrames,
    ),
  };
}

export function computeNonVerbalScore(summary: PresenceSummary) {
  if (summary.sampledFrames <= 0) {
    return null;
  }

  const weightedScore =
    summary.facePresencePct * SCORE_WEIGHTS.facePresence +
    summary.forwardAttentionPct * SCORE_WEIGHTS.forwardAttention +
    summary.headStabilityPct * SCORE_WEIGHTS.headStability +
    summary.speakingMouthActivityPct * SCORE_WEIGHTS.speakingMouthActivity;

  return Math.round(clamp(weightedScore, 0, 100));
}

export function buildPresenceSessionResult(
  accumulator: PresenceAccumulator,
  reason: PresenceUnavailableReason | null = null,
): PresenceSessionResult {
  const summary = summarizePresenceAccumulator(accumulator);
  const nonVerbalScore = computeNonVerbalScore(summary);
  const hasCapturedFrames = summary.sampledFrames > 0;

  if (reason && !hasCapturedFrames) {
    return {
      heuristics: [...NON_VERBAL_HEURISTICS],
      nonVerbalScore: null,
      reason,
      status: "unavailable",
      summary,
    };
  }

  return {
    heuristics: [...NON_VERBAL_HEURISTICS],
    nonVerbalScore,
    reason: hasCapturedFrames ? null : "no_session_frames",
    status: hasCapturedFrames ? "ready" : "unavailable",
    summary,
  };
}

export function createUnavailablePresenceResult(
  reason: PresenceUnavailableReason,
): PresenceSessionResult {
  return {
    heuristics: [...NON_VERBAL_HEURISTICS],
    nonVerbalScore: null,
    reason,
    status: "unavailable",
    summary: createEmptyPresenceSummary(),
  };
}

export function createMockPresenceSessionResult(): PresenceSessionResult {
  const summary: PresenceSummary = {
    faceDetectedFrames: 352,
    facePresencePct: 92,
    forwardAttentionPct: 84,
    headStabilityPct: 78,
    sampledFrames: 384,
    speakingFrames: 168,
    speakingMouthActivityPct: 74,
  };

  return {
    heuristics: [...NON_VERBAL_HEURISTICS],
    nonVerbalScore: computeNonVerbalScore(summary),
    reason: null,
    status: "ready",
    summary,
  };
}

export function getPresenceAvailabilityMessage(
  reason: PresenceUnavailableReason | null | undefined,
) {
  switch (reason) {
    case "analysis_failed":
      return "The recorded session could not be analyzed after the call ended.";
    case "camera_denied":
      return "Camera access was denied, so Presence was not scored for this session.";
    case "camera_disabled":
      return "The camera stayed off, so Presence stayed unavailable.";
    case "camera_error":
      return "The camera feed failed during the session, so Presence scoring is incomplete.";
    case "camera_unsupported":
      return "This browser cannot provide a webcam feed for Presence tracking.";
    case "model_load_failed":
      return "The face tracker did not load, so Presence scoring was skipped.";
    case "recording_missing":
      return "The recorded session video was unavailable for post-session presence analysis.";
    case "no_session_frames":
    default:
      return "Not enough camera frames were captured to score Presence.";
  }
}

export function mergePresenceScore(
  fallbackScore: number,
  presenceResult: PresenceSessionResult | null | undefined,
) {
  if (
    presenceResult?.status !== "ready" ||
    presenceResult.nonVerbalScore === null
  ) {
    return fallbackScore;
  }

  return presenceResult.nonVerbalScore;
}
