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
npm run typecheck
npm run lint
```

## Scope Notes

- Scenario and session data still default cleanly to mock mode when ElevenLabs credentials are not configured.
- The design direction is dark, futuristic, and mission-control inspired.
- The architecture is intentionally lean so the next MVP pages can grow without carrying generated shell baggage.

## ElevenLabs Live Session Setup

The live session page calls a local server endpoint at `/api/elevenlabs/signed-url` during `vite dev` and `vite preview`.

- If `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` are present, the page starts a real ElevenLabs conversational session over a signed WebSocket URL.
- If either server variable is missing, the page falls back to the existing mock transcript flow without breaking the UI.
- ElevenLabs secrets stay server-side only. Do not prefix them with `VITE_`.

Create a local `.env` file from `.env.example` and add:

```bash
VITE_APP_ID=app-your-local-id
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_private_agent_id
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
- If you deploy the app to a static host, mirror the same signed-URL handler in your real backend or serverless platform because Vite middleware only exists in local dev/preview.
