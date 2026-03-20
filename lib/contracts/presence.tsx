// lib/contracts/presence.ts
export type PresenceFrame = {
  timestamp: number;
  faceDetected: boolean;
  lookingForwardScore: number;
  headAngleYaw?: number;
  headAnglePitch?: number;
  mouthActive?: boolean;
};

export type PresenceSummary = {
  facePresencePct: number;
  forwardGazePct: number;
  stablePosturePct: number;
  speakingMouthActivityPct: number;
};