# VoiceForge Frontend Architecture

## Proposed Folder Structure

```text
src/
  app/
    App.tsx
    routes.tsx
  features/
    landing/
    dashboard/
    scenarios/
    session/
    history/
    practice/
  shared/
    brand/
    data/
    layout/
    lib/
    theme/
    ui/
```

## Files and Components Removed

- `src/pages/*`
- `src/components/common/*`
- `src/components/layouts/*`
- `src/components/ui/*`
- `src/components/dropzone.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/ThemeContext.tsx`
- `src/hooks/*`
- `src/lib/utils.ts`
- `src/types/*`
- `vite.config.dev.ts`
- `components.json`
- `TODO.md`
- `pnpm-workspace.yaml`

These were either generated shell code, unused generic wrappers, dead auth/backend paths, or template assets that were not part of the MVP surface.

## Files Renamed or Replaced

- `src/App.tsx` -> `src/app/App.tsx`
- `src/routes.tsx` -> `src/app/routes.tsx`
- flat page files moved into feature folders under `src/features/*`

## Reusable UI Primitives Extracted

- `Button`
- `Panel`
- `Input`
- `SegmentedControl`
- `ProgressBar`
- `Range`
- `AppShell`
- `PageIntro`
- `BrandMark`

The rule was to keep only primitives already justified by the MVP pages. No generic component inventory was carried forward.

## Cleanup Plan Executed

1. Replaced the generated flat page structure with `app / features / shared`.
2. Rebuilt the shell and UI primitives around the actual VoiceForge MVP routes.
3. Removed dead MeDo code paths and unused Radix/shadcn wrappers.
4. Consolidated mock data into `src/shared/data/mock.ts`.
5. Kept the dark mission-control visual direction while reducing noise and duplication.
