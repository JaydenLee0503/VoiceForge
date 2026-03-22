import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

import { LandingPage } from "@/features/landing/page";

const DashboardPage = lazy(async () => ({
  default: (await import("@/features/dashboard/page")).DashboardPage,
}));
const DebateModePage = lazy(async () => ({
  default: (await import("@/features/debate/page")).DebateModePage,
}));
const DebateSessionPage = lazy(async () => ({
  default: (await import("@/features/debate/session-page")).DebateSessionPage,
}));
const SessionHistoryPage = lazy(async () => ({
  default: (await import("@/features/history/page")).SessionHistoryPage,
}));
const CustomPracticeConfigPage = lazy(async () => ({
  default: (await import("@/features/practice/config-page")).CustomPracticeConfigPage,
}));
const CustomPracticeSessionPage = lazy(async () => ({
  default: (await import("@/features/practice/session-page")).CustomPracticeSessionPage,
}));
const ScenariosPage = lazy(async () => ({
  default: (await import("@/features/scenarios/page")).ScenariosPage,
}));
const LiveSessionPage = lazy(async () => ({
  default: (await import("@/features/session/live-session-page")).LiveSessionPage,
}));
const MediaPipeSmokePage = lazy(async () => ({
  default: (await import("@/features/session/mediapipe-smoke-page")).MediaPipeSmokePage,
}));
const ResultsPage = lazy(async () => ({
  default: (await import("@/features/session/results-page")).ResultsPage,
}));

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/dashboard",
    element: <DashboardPage />,
  },
  {
    path: "/debate",
    element: <DebateModePage />,
  },
  {
    path: "/debate/session",
    element: <DebateSessionPage />,
  },
  {
    path: "/scenarios",
    element: <ScenariosPage />,
  },
  {
    path: "/session/:scenarioId",
    element: <LiveSessionPage />,
  },
  {
    path: "/results",
    element: <ResultsPage />,
  },
  {
    path: "/smoke/mediapipe",
    element: <MediaPipeSmokePage />,
  },
  {
    path: "/history",
    element: <SessionHistoryPage />,
  },
  {
    path: "/practice/custom",
    element: <CustomPracticeConfigPage />,
  },
  {
    path: "/practice/custom/session",
    element: <CustomPracticeSessionPage />,
  },
];
