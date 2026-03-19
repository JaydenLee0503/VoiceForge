import type { RouteObject } from "react-router-dom";

import { DashboardPage } from "@/features/dashboard/page";
import { SessionHistoryPage } from "@/features/history/page";
import { LandingPage } from "@/features/landing/page";
import { CustomPracticeConfigPage } from "@/features/practice/config-page";
import { CustomPracticeSessionPage } from "@/features/practice/session-page";
import { ScenariosPage } from "@/features/scenarios/page";
import { LiveSessionPage } from "@/features/session/live-session-page";
import { ResultsPage } from "@/features/session/results-page";

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
