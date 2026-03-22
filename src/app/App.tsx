import { Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";

import { appRoutes } from "@/app/routes";

function AppRouteFallback() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-app-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-app-radial" />

      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="rounded-3xl border border-border bg-panel px-6 py-5 text-sm text-muted-foreground shadow-panel">
          Loading workspace...
        </div>
      </div>
    </div>
  );
}

const appRouter = createBrowserRouter([
  ...appRoutes,
  {
    path: "*",
    element: <Navigate replace to="/" />,
  },
]);

export default function App() {
  return (
    <Suspense fallback={<AppRouteFallback />}>
      <RouterProvider router={appRouter} />
    </Suspense>
  );
}
