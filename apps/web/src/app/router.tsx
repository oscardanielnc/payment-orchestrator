import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { SessionGate } from './SessionGate';

/**
 * Every page is its own chunk (`lazy`): a customer opening /pay/:token downloads the checkout,
 * never the dashboard, and a merchant never downloads Stripe.js until a checkout needs it.
 */
export const routes: RouteObject[] = [
  {
    path: '/pay/:token',
    lazy: async () => ({
      Component: (await import('../features/checkout/CheckoutPage')).CheckoutPage,
    }),
  },
  {
    element: <SessionGate />,
    children: [
      {
        path: '/login',
        lazy: async () => ({ Component: (await import('../features/auth/LoginPage')).LoginPage }),
      },
      {
        lazy: async () => ({
          Component: (await import('./ProtectedDashboard')).ProtectedDashboard,
        }),
        children: [
          { index: true, element: <Navigate to="/charges" replace /> },
          {
            path: 'charges',
            lazy: async () => ({
              Component: (await import('../features/charges/ChargesPage')).ChargesPage,
            }),
          },
          {
            path: 'charges/:id',
            lazy: async () => ({
              Component: (await import('../features/charges/ChargeDetailPage')).ChargeDetailPage,
            }),
          },
          {
            path: 'balances',
            lazy: async () => ({
              Component: (await import('../features/balances/BalancesPage')).BalancesPage,
            }),
          },
          {
            path: 'api-keys',
            lazy: async () => ({
              Component: (await import('../features/api-keys/ApiKeysPage')).ApiKeysPage,
            }),
          },
          { path: '*', element: <Navigate to="/charges" replace /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
