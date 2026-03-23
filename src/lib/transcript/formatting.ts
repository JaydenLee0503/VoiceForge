import type { SessionTranscriptEntry } from "../../../lib/voice-feedback/contracts";

function getSpeakerLabel(role: SessionTranscriptEntry["role"]) {
  if (role === "coach") {
    return "Coach";
  }

  if (role === "opponent") {
    return "Opponent";
  }

  return "You";
}

export function buildRawTranscript(turns: SessionTranscriptEntry[]) {
  return turns.map((turn) => `${turn.role}: ${turn.text}`).join("\n");
}

export function buildDisplayTranscript(turns: SessionTranscriptEntry[]) {
  return turns.map((turn) => `${getSpeakerLabel(turn.role)}\n${turn.text}`).join("\n\n");
}
