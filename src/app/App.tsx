import { Navigate, useRoutes } from "react-router-dom";

import { appRoutes } from "@/app/routes";

export default function App() {
  const element = useRoutes([
    ...appRoutes,
    {
      path: "*",
      element: <Navigate replace to="/" />,
    },
  ]);

  return element;
}
