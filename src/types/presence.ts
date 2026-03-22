export type PresenceUnavailableReason =
  | "analysis_failed"
  | "camera_denied"
  | "camera_disabled"
  | "camera_error"
  | "camera_unsupported"
  | "model_load_failed"
  | "no_session_frames"
  | "recording_missing";

export type PresenceHeadAngles = {
  pitch: number | null;
  roll: number | null;
  yaw: number | null;
};

export type PresenceFaceBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type LivePresenceFrame = {
  attentionScore: number;
  centerOffset: number | null;
  faceBounds: PresenceFaceBounds | null;
  faceDetected: boolean;
  forwardAttention: boolean;
  headAngles: PresenceHeadAngles;
  headStable: boolean;
  isUserSpeaking: boolean;
  mouthActive: boolean;
  mouthOpenness: number | null;
  timestampMs: number;
};

export type PresenceAccumulator = {
  faceDetectedFrames: number;
  forwardAttentionFrames: number;
  headComparableFrames: number;
  headStableFrames: number;
  lastHeadAngles: PresenceHeadAngles | null;
  lastMouthOpenness: number | null;
  mouthActiveSpeakingFrames: number;
  speakingFrames: number;
  totalFrames: number;
};

export type PresenceSummary = {
  faceDetectedFrames: number;
  facePresencePct: number;
  forwardAttentionPct: number;
  headStabilityPct: number;
  sampledFrames: number;
  speakingFrames: number;
  speakingMouthActivityPct: number;
};

export type PresenceSessionResult = {
  heuristics: string[];
  nonVerbalScore: number | null;
  reason: PresenceUnavailableReason | null;
  status: "ready" | "unavailable";
  summary: PresenceSummary;
};
