# VoiceForge

VoiceForge is a premium AI speaking coach frontend prototype. The current repo is a cleaned MVP shell focused on the product surface, not backend integration.

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

- The current implementation is frontend-only.
- Scenario and session data are mocked in `src/shared/data/mock.ts`.
- The design direction is dark, futuristic, and mission-control inspired.
- The architecture is intentionally lean so the next MVP pages can grow without carrying generated shell baggage.
