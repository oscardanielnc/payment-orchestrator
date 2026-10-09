import { beforeEach, describe, expect, it } from 'vitest';
import { JobQueue, type QueueName } from '../../../../shared/application/ports/job-queue';
import {
  FixedClock,
  ImmediateTransactionRunner,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import type { DeliveryAttempt, WebhookDelivery } from '../../domain/webhook-delivery';
import type { WebhookEndpoint } from '../../domain/webhook-endpoint';
import type { PublishedEvent } from '../../domain/webhook-event';
import {
  NotificationSettings,
  type SendResult,
  WebhookDeliveryRepository,
  WebhookEndpointRepository,
  WebhookSecrets,
  WebhookSender,
  WebhookSigner,
} from '../ports/notification-ports';
import { CreateWebhookEndpointUseCase } from './create-webhook-endpoint.use-case';
import { DeliverWebhookUseCase } from './deliver-webhook.use-case';
import { DisableWebhookEndpointUseCase } from './disable-webhook-endpoint.use-case';
import { FanOutEventUseCase } from './fan-out-event.use-case';

class InMemoryEndpoints extends WebhookEndpointRepository {
  rows: WebhookEndpoint[] = [];
  save(e: WebhookEndpoint) {
    if (!this.rows.includes(e)) this.rows.push(e);
    return Promise.resolve();
  }
  findById(id: string) {
    return Promise.resolve(this.rows.find((e) => e.id === id) ?? null);
  }
  findForOrganization(org: string, id: string) {
    return Promise.resolve(this.rows.find((e) => e.id === id && e.organizationId === org) ?? null);
  }
  listForOrganization(org: string) {
    return Promise.resolve(this.rows.filter((e) => e.organizationId === org));
  }
  listEnabledForOrganization(org: string) {
    return Promise.resolve(this.rows.filter((e) => e.organizationId === org && e.enabled));
  }
}

class InMemoryDeliveries extends WebhookDeliveryRepository {
  rows: WebhookDelivery[] = [];
  attempts: DeliveryAttempt[] = [];
  insertIfAbsent(d: WebhookDelivery) {
    const existing = this.rows.find(
      (r) => r.endpointId === d.endpointId && r.eventId === d.eventId,
    );
    if (existing) return Promise.resolve(existing);
    this.rows.push(d);
    return Promise.resolve(d);
  }
  save(d: WebhookDelivery) {
    this.attempts.push(...d.pullNewAttempts());
    return Promise.resolve();
  }
  findById(id: string) {
    return Promise.resolve(this.rows.find((d) => d.id === id) ?? null);
  }
  findForOrganization() {
    return Promise.resolve(null);
  }
  listForOrganization() {
    return Promise.resolve({ items: this.rows, next: null });
  }
  findNeverAttempted() {
    return Promise.resolve([]);
  }
}

class RecordingQueue extends JobQueue {
  jobs: { queue: QueueName; jobId: string }[] = [];
  enqueue(queue: QueueName, jobId: string) {
    this.jobs.push({ queue, jobId });
    return Promise.resolve();
  }
}

/** Reversible "encryption" so tests can see that the stored value is not the secret. */
class FakeSecrets extends WebhookSecrets {
  generate = () => 'whsec_fake'; // gitleaks:allow (made-up test secret)
  encrypt = (s: string) => `enc(${s})`;
  decrypt = (c: string) => c.slice(4, -1);
}

class FakeSigner extends WebhookSigner {
  sign = (secret: string, _body: string, t: number) => `t=${t},v1=${secret}`;
}

class ScriptedSender extends WebhookSender {
  responses: (number | null)[] = [];
  sent: { url: string; headers: Record<string, string> }[] = [];
  send(request: {
    url: string;
    body: string;
    headers: Record<string, string>;
  }): Promise<SendResult> {
    this.sent.push(request);
    const statusCode = this.responses.shift() ?? 200;
    return Promise.resolve({
      statusCode,
      error: statusCode === 200 ? null : 'HTTP error',
      durationMs: 5,
    });
  }
}

describe('outbound webhooks', () => {
  let endpoints: InMemoryEndpoints;
  let deliveries: InMemoryDeliveries;
  let queue: RecordingQueue;
  let sender: ScriptedSender;
  let clock: FixedClock;
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    endpoints = new InMemoryEndpoints();
    deliveries = new InMemoryDeliveries();
    queue = new RecordingQueue();
    sender = new ScriptedSender();
    clock = new FixedClock();
    ids = new SequentialIdGenerator();
  });

  const settings: NotificationSettings = { allowLocalHttp: false };
  const createEndpoint = (url = 'https://shop.example.com/hooks', org = 'org-1') =>
    new CreateWebhookEndpointUseCase(endpoints, new FakeSecrets(), settings, ids, clock).execute({
      organizationId: org,
      url,
    });
  const fanOut = () =>
    new FanOutEventUseCase(
      endpoints,
      deliveries,
      queue,
      ids,
      clock,
      new ImmediateTransactionRunner(),
    );
  const deliver = (deliveryId: string, isLastAllowed = false) =>
    new DeliverWebhookUseCase(
      deliveries,
      endpoints,
      new FakeSecrets(),
      new FakeSigner(),
      sender,
      clock,
    ).execute({ deliveryId, isLastAllowed });
  const event = (type = 'charge.succeeded', org = 'org-1'): PublishedEvent => ({
    id: 'evt-1',
    type,
    organizationId: org,
    occurredAt: '2026-10-09T12:00:00.000Z',
    payload: { chargeId: 'ch-1', status: 'succeeded', amount: '2500', currency: 'USD' },
  });

  it('stores the secret encrypted and returns it once', async () => {
    const { endpoint, secret } = await createEndpoint();

    expect(secret).toBe('whsec_fake');
    expect(endpoint.secretCiphertext).toBe('enc(whsec_fake)');
  });

  it("fans out once per enabled endpoint of the event's organization, idempotently", async () => {
    await createEndpoint('https://a.example.com/hooks');
    const { endpoint: disabled } = await createEndpoint('https://b.example.com/hooks');
    await createEndpoint('https://other.example.com/hooks', 'org-2');
    await new DisableWebhookEndpointUseCase(endpoints, clock).execute({
      organizationId: 'org-1',
      endpointId: disabled.id,
    });

    expect(await fanOut().execute(event())).toBe(1);
    expect(await fanOut().execute(event())).toBe(1); // re-relayed: same delivery, enqueued again
    expect(deliveries.rows).toHaveLength(1);
    expect(new Set(queue.jobs.map((j) => j.jobId)).size).toBe(1);
    expect(JSON.parse(deliveries.rows[0]?.payload ?? '')).toMatchObject({
      id: 'evt-1',
      type: 'charge.succeeded',
      data: { object: 'charge', id: 'ch-1', amount: '2500' },
    });
  });

  it('keeps internal events internal', async () => {
    await createEndpoint();

    expect(await fanOut().execute(event('charge.processing'))).toBe(0);
    expect(deliveries.rows).toHaveLength(0);
  });

  it('signs with the decrypted secret and records each attempt', async () => {
    await createEndpoint();
    await fanOut().execute(event());
    const id = deliveries.rows[0]?.id ?? '';
    sender.responses = [500, 200];

    await deliver(id);
    await deliver(id);

    expect(sender.sent[0]?.headers).toMatchObject({
      'PO-Event-Id': 'evt-1',
      'PO-Signature': `t=${Math.floor(clock.now().getTime() / 1000)},v1=whsec_fake`,
    });
    expect(deliveries.attempts.map((a) => a.statusCode)).toEqual([500, 200]);
    expect(deliveries.rows[0]?.status).toBe('succeeded');
    expect(await deliver(id)).toBeNull(); // a duplicate job sends nothing
    expect(sender.sent).toHaveLength(2);
  });

  it('fails on the last allowed attempt and stops for disabled endpoints', async () => {
    const { endpoint } = await createEndpoint();
    await fanOut().execute(event());
    await fanOut().execute({ ...event(), id: 'evt-2' });
    const [first, second] = deliveries.rows;
    sender.responses = [500];

    await deliver(first?.id ?? '', true);
    endpoint.disable(clock.now());
    await deliver(second?.id ?? '');

    expect(first?.status).toBe('failed');
    expect([second?.status, second?.lastError]).toEqual(['failed', 'Endpoint disabled']);
    expect(sender.sent).toHaveLength(1);
  });
});
