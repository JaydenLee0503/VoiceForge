import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Scenarios from './pages/Scenarios';
import LiveSession from './pages/LiveSession';
import Results from './pages/Results';
import History from './pages/History';
import CustomPracticeConfig from './pages/CustomPracticeConfig';
import CustomPracticeSession from './pages/CustomPracticeSession';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: 'Landing',
    path: '/',
    element: <LandingPage />
  },
  {
    name: 'Dashboard',
    path: '/dashboard',
    element: <Dashboard />
  },
  {
    name: 'Scenarios',
    path: '/scenarios',
    element: <Scenarios />
  },
  {
    name: 'Live Session',
    path: '/session/:id',
    element: <LiveSession />
  },
  {
    name: 'Results',
    path: '/results',
    element: <Results />
  },
  {
    name: 'History',
    path: '/history',
    element: <History />
  },
  {
    name: 'Custom Practice Config',
    path: '/custom-practice',
    element: <CustomPracticeConfig />
  },
  {
    name: 'Custom Practice Session',
    path: '/custom-practice/session',
    element: <CustomPracticeSession />
  }
];

export default routes;
