import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/landing/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { UnauthorizedPage } from './pages/auth/UnauthorizedPage';

// Control Center Layout & Pages
import { ControlCenterLayout } from './pages/control/ControlCenterLayout';
import { OverviewPage } from './pages/control/OverviewPage';
import { OrdersPage } from './pages/control/OrdersPage';
import { WarehousesPage } from './pages/control/WarehousesPage';
import { MissionControlPage } from './pages/control/MissionControlPage';
import { LiveOperationsPage } from './pages/control/LiveOperationsPage';
import { FleetPage } from './pages/control/FleetPage';
import { RoadIntelligencePage } from './pages/control/RoadIntelligencePage';
import { AlgorithmLabPage } from './pages/control/AlgorithmLabPage';
import { AnalyticsPage } from './pages/control/AnalyticsPage';
import { DigitalTwinPage } from './pages/control/DigitalTwinPage';

// Driver Layout & Pages
import { DriverLayout } from './pages/driver/DriverLayout';
import { DriverHomePage } from './pages/driver/DriverHomePage';
import { DriverNavigationPage } from './pages/driver/DriverNavigationPage';
import { DriverMissionsPage } from './pages/driver/DriverMissionsPage';
import { DriverIncidentsPage } from './pages/driver/DriverIncidentsPage';
import { DriverLogsPage } from './pages/driver/DriverLogsPage';

// Guards
import { RoleGuard } from './guards/RoleGuard';
import { PublicOnlyRoute } from './guards/PublicOnlyRoute';

export const router = createBrowserRouter([
  // Public Landing / Gateway
  {
    path: '/',
    element: <LandingPage />,
  },

  // Auth Routes (guarded against already authenticated sessions)
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/signup',
        element: <SignupPage />,
      },
    ],
  },

  // Access Violation / Unauthorized Screen
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },

  // CONTROL_CENTER Terminal (Strictly isolated by role & persistent layout)
  {
    path: '/control',
    element: <RoleGuard allowedRoles={['CONTROL_CENTER']} />,
    children: [
      {
        element: <ControlCenterLayout />,
        children: [
          {
            index: true,
            element: <OverviewPage />,
          },
          {
            path: 'orders',
            element: <OrdersPage />,
          },
          {
            path: 'warehouses',
            element: <WarehousesPage />,
          },
          {
            path: 'missions',
            element: <MissionControlPage />,
          },
          {
            path: 'live',
            element: <LiveOperationsPage />,
          },
          {
            path: 'fleet',
            element: <FleetPage />,
          },
          {
            path: 'intelligence',
            element: <RoadIntelligencePage />,
          },
          {
            path: 'lab',
            element: <AlgorithmLabPage />,
          },
          {
            path: 'analytics',
            element: <AnalyticsPage />,
          },
          {
            path: 'twin',
            element: <DigitalTwinPage />,
          },
          {
            path: '*',
            element: <Navigate to="/control" replace />,
          },
        ],
      },
    ],
  },

  // DRIVER Terminal (Strictly isolated by role & persistent layout)
  {
    path: '/driver',
    element: <RoleGuard allowedRoles={['DRIVER']} />,
    children: [
      {
        element: <DriverLayout />,
        children: [
          {
            index: true,
            element: <DriverHomePage />,
          },
          {
            path: 'navigation',
            element: <DriverNavigationPage />,
          },
          {
            path: 'missions',
            element: <DriverMissionsPage />,
          },
          {
            path: 'incidents',
            element: <DriverIncidentsPage />,
          },
          {
            path: 'logs',
            element: <DriverLogsPage />,
          },
          {
            path: '*',
            element: <Navigate to="/driver" replace />,
          },
        ],
      },
    ],
  },

  // Fallback Catch-All
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
