# VoiceForge

VoiceForge is a premium AI speaking coach MVP shell. The repo now includes a first local ElevenLabs live-session integration while keeping a graceful mock fallback when server credentials are missing.

## Current Surface

- Landing page
- Dashboard
- Scenario picker
- Live session page
- Results page
- Session history page
- Custom practice configuration and timed session flow

## Frontend Architecture

```text
src/
  app/        router and app entry
  features/   page-level product areas
  shared/     shell, theme, UI primitives, mock data
```

Detailed cleanup notes live in [docs/frontend-architecture.md](./docs/frontend-architecture.md).

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Biome

## Commands

```bash
npm install
npm run dev
npm run build
npm run serve
npm run typecheck
npm run lint
```

## Scope Notes

- Scenario and session data still default cleanly to mock mode when ElevenLabs credentials are not configured.
- Post-session feedback and live speaking metrics default cleanly to deterministic mock output when Groq is not configured.
- The design direction is dark, futuristic, and mission-control inspired.
- The architecture is intentionally lean so the next MVP pages can grow without carrying generated shell baggage.

## Runtime

- `npm run dev` keeps the existing Vite-first local workflow.
- `npm run build` now emits both the client bundle in `dist/` and a Node runtime in `dist-server/`.
- `npm run serve` starts the compiled Node runtime, serves the built frontend, and exposes the same `/api/*` routes without depending on Vite middleware.

## ElevenLabs Live Session Setup

The live session page calls `/api/elevenlabs/signed-url`.

- If `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` are present, the page starts a real ElevenLabs conversational session over a signed WebSocket URL.
- If either server variable is missing, the page falls back to the existing mock transcript flow without breaking the UI.
- ElevenLabs secrets stay server-side only. Do not prefix them with `VITE_`.

Create a local `.env` file from `.env.example` and add:

```bash
VITE_APP_ID=app-your-local-id
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_private_agent_id
GROQ_API_KEY=your_private_groq_api_key
GROQ_API_KEYS=key_one,key_two,key_three
```

You still need to configure the ElevenLabs side:

- Create or choose a conversational agent in the ElevenLabs dashboard.
- Copy the agent ID for that agent.
- Generate an ElevenLabs API key with access to conversational AI.
- Keep the agent private if you want the signed-URL flow used here.
- In the agent settings, make sure transcript-related events are enabled so the page receives user and coach transcript updates.

Local runtime notes:

- Microphone access must be allowed in the browser.
- Use `localhost` or HTTPS so `getUserMedia` is available.
- Use `npm run serve` to exercise the compiled Node runtime locally after `npm run build`.
- If you deploy the app to a static host, you still need to mirror the same handlers in your real backend or serverless platform because the static bundle alone does not contain `/api/*`.

## Groq Feedback Setup

VoiceForge now uses local server middleware for Groq-backed coaching copy and live metric guidance.

- `GROQ_API_KEY` must stay server-side only. Do not prefix it with `VITE_`.
- `GROQ_API_KEYS` is optional and should be a comma-separated server-side list when you want the post-session analysis swarm to distribute work across 2-3 Groq keys.
- Post-session scoring remains deterministic in code. Groq is only used to generate concise coaching copy for `coachSummary`, `bestMoment`, `improvementArea`, and `nextChallenge`.
- Post-session feedback now runs as a small server-side swarm of specialist analyzers. Different Groq models review strengths, summary, improvement area, and next challenge independently, then VoiceForge combines the results.
- Live speaking metric scores remain deterministic in code. Live Groq feedback still uses a single request path to enrich the short live labels and coaching cue, but it now prefers a stable low-latency stack: `llama-3.1-8b-instant`, `qwen/qwen3-32b`, then `llama-3.3-70b-versatile`.
- The post-session swarm now prefers a stable Llama/Qwen mix: `llama-3.3-70b-versatile`, `qwen/qwen3-32b`, and `llama-3.1-8b-instant`.
- `openai/gpt-oss-120b` is no longer used for the post-session swarm because its JSON-mode behavior was less reliable for this workflow and caused avoidable fallback retries.
- If `GROQ_API_KEYS` is present, the post-session swarm rotates across those keys. If only `GROQ_API_KEY` is present, the swarm reuses that single key.
- If no Groq key is present, the app keeps working with deterministic mock feedback instead of failing.
