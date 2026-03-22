import type { SessionTranscriptEntry } from "../../../lib/voice-feedback/contracts";

export function buildRawTranscript(turns: SessionTranscriptEntry[]) {
  return turns.map((turn) => `${turn.role}: ${turn.text}`).join("\n");
}

export function buildDisplayTranscript(turns: SessionTranscriptEntry[]) {
  return turns
    .map(
      (turn) =>
        `${turn.role === "coach" ? "Coach" : "You"}\n${turn.text}`,
    )
    .join("\n\n");
}
