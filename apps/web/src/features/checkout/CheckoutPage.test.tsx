import type { CheckoutAttempt, CheckoutSession } from '@po/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/router';

const TOKEN = 'q4Yc2T9pX1mBv7Kd0Lz8Wg'; // gitleaks:allow (made-up checkout token)
const ADDRESS = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';

const session = (overrides: Partial<CheckoutSession> = {}): CheckoutSession => ({
  merchantName: 'Mi Tienda',
  amount: '10000000',
  currency: 'USDT',
  description: 'Two flat whites',
  status: 'pending',
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  methods: ['usdt_tron'],
  attempt: null,
  stripePublishableKey: null,
  ...overrides,
});
const usdtAttempt: CheckoutAttempt = {
  method: 'usdt_tron',
  status: 'pending',
  failureReason: null,
  instructions: {
    type: 'crypto_transfer',
    network: 'tron-nile',
    token: 'USDT',
    address: ADDRESS,
    amount: '10000000',
  },
};
const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

let current: CheckoutSession;
const fetchMock = vi.fn((input: string, init?: RequestInit) => {
  if (input === `/v1/checkout/${TOKEN}/attempts` && init?.method === 'POST') {
    current = { ...current, status: 'processing', attempt: usdtAttempt };
    return json(usdtAttempt);
  }
  if (input === `/v1/checkout/${TOKEN}`) return json(current);
  return json({ code: 'charge.not_found' }, 404);
});

function openCheckout(token = TOKEN) {
  const router = createMemoryRouter(routes, { initialEntries: [`/pay/${token}`] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('checkout page', () => {
  beforeEach(() => {
    current = session();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows merchant, amount and methods, all on test networks', async () => {
    openCheckout();

    expect(await screen.findByText('Mi Tienda')).toBeInTheDocument();
    expect(screen.getByText('10.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'USDT on TRON Nile testnet' })).toBeInTheDocument();
    expect(screen.getByText(/Expires in/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/mainnet/i);
    // A public page never tries to restore a dashboard session.
    expect(fetchMock).not.toHaveBeenCalledWith('/v1/auth/refresh', expect.anything());
  });

  it('shows network, exact amount and address after choosing USDT', async () => {
    openCheckout();

    await userEvent.click(await screen.findByRole('button', { name: 'USDT on TRON Nile testnet' }));

    expect(await screen.findByText(ADDRESS)).toBeInTheDocument();
    expect(screen.getByText('TRON Nile testnet (TRC-20)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy amount' })).toBeInTheDocument();
    expect(screen.getByText('10.00', { selector: 'code' })).toBeInTheDocument();
  });

  it('turns to "Payment received" on the next poll, without a reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    current = session({ status: 'processing', attempt: usdtAttempt });
    openCheckout();
    expect(await screen.findByText(ADDRESS)).toBeInTheDocument();

    current = { ...current, status: 'succeeded', attempt: { ...usdtAttempt, status: 'succeeded' } };
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(await screen.findByText('Payment received')).toBeInTheDocument();
    expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument();
  });

  it('shows an expired link as expired, with no way to pay', async () => {
    current = session({ status: 'expired' });
    openCheckout();

    expect(await screen.findByText('This payment link has expired')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Payment method' })).not.toBeInTheDocument();
  });

  it('says so when the link does not exist', async () => {
    openCheckout('AAAAAAAAAAAAAAAAAAAAAA');

    expect(await screen.findByText('This payment link does not exist')).toBeInTheDocument();
  });
});
