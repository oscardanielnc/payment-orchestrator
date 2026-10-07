import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../lib/session-store';
import { routes } from './router';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'owner@shop.test',
  role: 'owner' as const,
  organizationId: '00000000-0000-4000-8000-000000000002',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('dashboard app', () => {
  beforeEach(() => {
    useSession.setState({ accessToken: null, user: null, ready: true });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input === '/v1/charges' && init?.method === 'POST')
          return Promise.resolve(
            json({ checkoutUrl: 'http://localhost:5173/pay/q4Yc2T9pX1mBv7Kd0Lz8Wg' }, 201),
          );
        if (input === '/v1/auth/login')
          return Promise.resolve(
            json({ accessToken: 'a', tokenType: 'Bearer', expiresIn: 900, user }),
          );
        if (input === '/v1/organization')
          return Promise.resolve(
            json({
              id: user.organizationId,
              name: 'Mi Tienda',
              createdAt: '2026-10-04T12:00:00.000Z',
            }),
          );
        if (input.startsWith('/v1/charges'))
          return Promise.resolve(json({ data: [], nextCursor: null }));
        return Promise.resolve(json({}, 404));
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends signed-out visitors to sign in, then back to the charges list', async () => {
    const router = renderAt('/charges');

    await userEvent.type(await screen.findByLabelText('Email'), user.email);
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Charges' })).toBeInTheDocument();
    expect(await screen.findByText('Mi Tienda')).toBeInTheDocument();
    expect(screen.getByText('No charges yet')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/charges');
  });

  it('keeps the status filter in the URL', async () => {
    useSession.setState({ accessToken: 'a', user });
    const router = renderAt('/charges');

    await userEvent.click(await screen.findByRole('button', { name: 'Failed' }));

    expect(router.state.location.search).toBe('?status=failed');
    expect(await screen.findByText('No failed charges')).toBeInTheDocument();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/v1/charges?limit=20&status=failed',
      expect.anything(),
    );
  });

  it('creates a payment link from a typed amount, sent in minor units', async () => {
    useSession.setState({ accessToken: 'a', user });
    renderAt('/charges');

    await userEvent.click(await screen.findByRole('button', { name: 'New payment link' }));
    await userEvent.type(screen.getByLabelText('Amount'), '25.50');
    await userEvent.type(screen.getByLabelText('Description'), 'Two flat whites');
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));

    expect(
      await screen.findByText('http://localhost:5173/pay/q4Yc2T9pX1mBv7Kd0Lz8Wg'),
    ).toBeInTheDocument();
    const [, init] = vi.mocked(fetch).mock.calls.find(([, i]) => i?.method === 'POST') ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({
      amount: '2550',
      currency: 'USD',
      description: 'Two flat whites',
    });
    expect(new Headers(init?.headers).get('Idempotency-Key')).toMatch(/^[\w-]{36}$/);
  });

  it('refuses an amount the currency cannot represent', async () => {
    useSession.setState({ accessToken: 'a', user });
    renderAt('/charges');

    await userEvent.click(await screen.findByRole('button', { name: 'New payment link' }));
    await userEvent.type(screen.getByLabelText('Amount'), '1.999');
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));

    expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription(
      'Enter a positive amount in USD',
    );
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith('/v1/charges', expect.anything());
  });
});
