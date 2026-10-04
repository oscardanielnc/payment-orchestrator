import { createBrowserRouter, Navigate } from 'react-router';
import { ApiKeysPage } from '../features/api-keys/ApiKeysPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { BalancesPage } from '../features/balances/BalancesPage';
import { ChargeDetailPage } from '../features/charges/ChargeDetailPage';
import { ChargesPage } from '../features/charges/ChargesPage';
import { DashboardLayout } from './DashboardLayout';

export const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/charges" replace /> },
      { path: 'charges', element: <ChargesPage /> },
      { path: 'charges/:id', element: <ChargeDetailPage /> },
      { path: 'balances', element: <BalancesPage /> },
      { path: 'api-keys', element: <ApiKeysPage /> },
      { path: '*', element: <Navigate to="/charges" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
