# Debate Mode

Debate Mode is an isolated feature slice that reuses the existing VoiceForge live-session, transcript, recording, feedback, and session-sync architecture.

## Integration

- Entry points live at `/debate` and `/debate/session`, with additional dashboard and landing-page links.
- The existing `useLiveSession` and `startLiveSession` path now accepts a configurable session profile. Debate Mode uses:
  - `signedUrlMode: "debate"` so the server can use `ELEVENLABS_DEBATE_AGENT_ID` when configured
  - `agentRole: "opponent"` so transcript turns stay distinct from the normal coach flow
  - contextual updates on round changes so the AI opponent shifts between opening, rebuttal, and closing behavior without rewriting the provider stack
- Debate sessions persist through the same local history and Supabase session tables as other modes. The payload now stores:
  - `mode: "debate"`
  - `debateSettings`
  - `debateResult`
  - the same transcript, presence, and verbal metrics fields already used elsewhere

## Scoring

- The base debate score is deterministic and transcript-driven. It combines:
  - clarity
  - confidence
  - argument strength
  - rebuttal quality
  - structure
  - pace
  - presence
  - persuasiveness
- Round scores are generated from the configured round plan. Each round is scored against a difficulty-adjusted baseline so the app can produce per-round win, lose, or draw outcomes.
- Presence is merged from the existing post-session MediaPipe summary when available; otherwise the system falls back to transcript-derived speaking signals.
- The Groq debate judge is an overlay, not the source of truth. It contributes:
  - winner lean
  - strongest argument
  - weakest argument
  - rebuttal quality summary
  - suggested improvement
- The deterministic result remains the primary score. The judge layer only enriches the verdict copy and breaks ties when the deterministic outcome is a draw.
