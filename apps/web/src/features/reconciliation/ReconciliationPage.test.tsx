import type { ReconciliationFinding } from '@po/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/router';
import { useSession } from '../../lib/session-store';

const user = (role: 'owner' | 'member') => ({
  id: '00000000-0000-4000-8000-000000000001',
  email: `${role}@shop.test`,
  role,
  organizationId: '00000000-0000-4000-8000-000000000002',
});
const finding: ReconciliationFinding = {
  id: '00000000-0000-4000-8000-0000000000f1',
  source: 'stripe',
  kind: 'missing_in_ledger',
  chargeId: '00000000-0000-4000-8000-0000000000c1',
  currency: 'USD',
  providerAmount: '700',
  ledgerAmount: '0',
  status: 'open',
  firstSeenAt: '2026-10-13T01:00:00.000Z',
  lastSeenAt: '2026-10-13T01:00:00.000Z',
  resolvedAt: null,
  note: null,
};
const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

function open(path = '/reconciliation') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('reconciliation page', () => {
  let current: ReconciliationFinding;
  let requested: string[];

  beforeEach(() => {
    current = { ...finding };
    requested = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        requested.push(input);
        if (
          input === `/v1/reconciliation/findings/${finding.id}/resolve` &&
          init?.method === 'POST'
        ) {
          current = { ...current, status: 'resolved', resolvedAt: current.firstSeenAt };
          return json(current);
        }
        if (input.startsWith('/v1/reconciliation/findings?'))
          return json({ data: [current], nextCursor: null });
        if (input === '/v1/organization')
          return json({ id: 'o', name: 'Mi Tienda', createdAt: finding.firstSeenAt });
        return json({}, 404);
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('explains each difference with both amounts, and lets an owner resolve it', async () => {
    useSession.setState({ accessToken: 'a', user: user('owner'), ready: true });
    open();

    expect(await screen.findByText('Paid at provider, not recorded')).toBeInTheDocument();
    expect(screen.getByText('7.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));

    const table = screen.getByRole('table', { name: 'Reconciliation findings' });
    expect(await within(table).findByText('Resolved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark resolved' })).not.toBeInTheDocument();
  });

  it('keeps the status filter in the URL and hides resolving from members', async () => {
    useSession.setState({ accessToken: 'a', user: user('member'), ready: true });
    open('/reconciliation?status=open');

    expect(await screen.findByText('Paid at provider, not recorded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
    expect(requested.some((r) => r.includes('status=open'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Mark resolved' })).not.toBeInTheDocument();
  });
});
