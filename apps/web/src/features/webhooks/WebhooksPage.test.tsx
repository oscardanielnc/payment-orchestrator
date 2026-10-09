import type { WebhookDelivery, WebhookDeliveryDetail } from '@po/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/router';
import { useSession } from '../../lib/session-store';

const SECRET = 'whsec_madeUpForThisTest'; // gitleaks:allow (made-up test secret)
const user = (role: 'owner' | 'member') => ({
  id: '00000000-0000-4000-8000-000000000001',
  email: `${role}@shop.test`,
  role,
  organizationId: '00000000-0000-4000-8000-000000000002',
});
const delivery: WebhookDelivery = {
  id: '00000000-0000-4000-8000-0000000000d1',
  endpointId: '00000000-0000-4000-8000-0000000000e1',
  eventId: '00000000-0000-4000-8000-0000000000a1',
  eventType: 'charge.succeeded',
  status: 'succeeded',
  attemptCount: 2,
  lastStatusCode: 200,
  lastError: null,
  createdAt: '2026-10-09T12:00:00.000Z',
  deliveredAt: '2026-10-09T12:00:31.000Z',
};
const detail: WebhookDeliveryDetail = {
  ...delivery,
  payload: '{"id":"evt","type":"charge.succeeded"}',
  attempts: [
    { attemptedAt: '2026-10-09T12:00:01.000Z', statusCode: 500, error: 'HTTP 500', durationMs: 40 },
    { attemptedAt: '2026-10-09T12:00:31.000Z', statusCode: 200, error: null, durationMs: 35 },
  ],
};
const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

function openWebhooks() {
  const router = createMemoryRouter(routes, { initialEntries: ['/webhooks'] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('webhooks page', () => {
  let endpoints: { id: string; url: string; createdAt: string; disabledAt: null }[];

  beforeEach(() => {
    endpoints = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input === '/v1/webhook-endpoints' && init?.method === 'POST') {
          const created = {
            id: '00000000-0000-4000-8000-0000000000e1',
            url: 'https://shop.example.com/hooks',
            createdAt: '2026-10-09T12:00:00.000Z',
            disabledAt: null,
          };
          endpoints = [created];
          return json({ ...created, secret: SECRET }, 201);
        }
        if (input === '/v1/webhook-endpoints') return json({ data: endpoints });
        if (input.startsWith('/v1/webhook-deliveries?'))
          return json({ data: [delivery], nextCursor: null });
        if (input === `/v1/webhook-deliveries/${delivery.id}`) return json(detail);
        if (input === '/v1/organization')
          return json({ id: 'o', name: 'Mi Tienda', createdAt: delivery.createdAt });
        return json({}, 404);
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lets an owner add an endpoint and shows its secret once', async () => {
    useSession.setState({ accessToken: 'a', user: user('owner'), ready: true });
    openWebhooks();

    await userEvent.type(
      await screen.findByLabelText('Endpoint URL'),
      'https://shop.example.com/hooks',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add endpoint' }));

    expect(await screen.findByText(SECRET)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Disable https://shop.example.com/hooks' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
  });

  it('shows the delivery log and each attempt of a delivery', async () => {
    useSession.setState({ accessToken: 'a', user: user('member'), ready: true });
    openWebhooks();

    expect(
      await screen.findByText('Only owners can add or disable endpoints.'),
    ).toBeInTheDocument();
    await userEvent.click(await screen.findByText('Delivered'));

    const attempts = await screen.findByRole('table', { name: 'Delivery attempts' });
    expect(within(attempts).getByText('500')).toBeInTheDocument();
    expect(within(attempts).getByText('200')).toBeInTheDocument();
    expect(screen.getByText(delivery.eventId)).toBeInTheDocument();
  });
});
