import type { INestApplication } from '@nestjs/common';
import type {
  AccessTokenResponse,
  Charge,
  CreatedWebhookEndpoint,
  WebhookDeliveryDetail,
  WebhookDeliveryList,
  WebhookEvent,
} from '@po/contracts';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChargePaymentsService } from '../src/modules/charges/application/services/charge-payments.service';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { CreateUserUseCase } from '../src/modules/identity/application/use-cases/create-user.use-case';
import { FanOutEventUseCase } from '../src/modules/notifications/application/use-cases/fan-out-event.use-case';
import { TransactionRunner } from '../src/shared/application/ports/transaction-runner';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp, eventually } from './setup/create-test-app';

type Verify = (body: string, header: string, secret: string) => boolean;
const PASSWORD = 'correct horse battery staple'; // gitleaks:allow (test-only password)

/** Plays the merchant: records every request and answers with scripted statuses. */
class MerchantServer {
  received: { headers: IncomingHttpHeaders; body: string; path: string }[] = [];
  statuses = new Map<string, number[]>(); // path → statuses to answer, then 200
  private server: Server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
    req.on('end', () => {
      const path = req.url ?? '';
      this.received.push({ headers: req.headers, body, path });
      res.statusCode = this.statuses.get(path)?.shift() ?? 200;
      res.end();
    });
  });

  async start(): Promise<string> {
    await new Promise<void>((done) => this.server.listen(0, '127.0.0.1', done));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  close(): Promise<void> {
    return new Promise((done) => this.server.close(() => done()));
  }
}

describe('Outbound webhooks (real Postgres + Redis, worker running)', () => {
  let app: INestApplication<App>;
  let merchant: MerchantServer;
  let baseUrl: string;
  let verify: Verify;
  let seq = 0;

  beforeAll(async () => {
    app = await createTestApp({ worker: true, env: { LOGIN_RATE_LIMIT_PER_MINUTE: '100' } });
    merchant = new MerchantServer();
    baseUrl = await merchant.start();
    const snippet = resolve(__dirname, '../../../docs/examples/verify-webhook-signature.mjs');
    ({ verifyWebhookSignature: verify } = (await import(pathToFileURL(snippet).href)) as {
      verifyWebhookSignature: Verify;
    });
  });

  afterAll(async () => {
    await merchant.close();
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** A fresh organization per scenario: fan-out goes to every endpoint of an organization. */
  async function newMerchant() {
    seq += 1;
    const org = await app.get(CreateOrganizationUseCase).execute({ name: `Shop ${seq}` });
    const email = `owner-${Date.now()}-${seq}@shop.test`;
    await app.get(CreateUserUseCase).execute({
      organizationId: org.organization.id,
      email,
      password: PASSWORD,
      role: 'owner',
    });
    const login = await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const token = (login.body as AccessTokenResponse).accessToken;
    return { apiKey: org.token, token, organizationId: org.organization.id };
  }

  const addEndpoint = async (token: string, path: string) =>
    (
      await http()
        .post('/v1/webhook-endpoints')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: `${baseUrl}${path}` })
        .expect(201)
    ).body as CreatedWebhookEndpoint;

  /** Creates a charge and pays it through the charges module, as a provider would. */
  async function payCharge(apiKey: string, organizationId: string) {
    const charge = (
      await http()
        .post('/v1/charges')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Idempotency-Key', `wh-${Date.now()}-${(seq += 1)}`)
        .send({ amount: '2500', currency: 'USD', reference: 'order-77' })
        .expect(201)
    ).body as Charge;
    const payments = app.get(ChargePaymentsService);
    await app.get(TransactionRunner).run(async () => {
      await payments.beginAttempt(organizationId, charge.id);
      await payments.markPaid(organizationId, charge.id);
    });
    await relayToWebhooks(charge.id);
    return charge;
  }

  /**
   * Test files run in parallel against one database, so another file's outbox relay may claim
   * this event and shut down before handling it. Fanning out the stored event here, as the
   * relay would, keeps the test deterministic; fan-out is idempotent, so a real relay doing it
   * too changes nothing.
   */
  async function relayToWebhooks(chargeId: string) {
    const prisma = app.get(PrismaService);
    const stored = await prisma.outboxEvent.findMany({ where: { aggregateId: chargeId } });
    for (const event of stored) {
      await app.get(FanOutEventUseCase).execute({
        id: event.id,
        type: event.type,
        organizationId: event.organizationId,
        occurredAt: event.occurredAt.toISOString(),
        payload: event.payload as Record<string, unknown>,
      });
    }
  }

  const deliveriesOf = async (token: string) =>
    (
      (await http().get('/v1/webhook-deliveries').set('Authorization', `Bearer ${token}`))
        .body as WebhookDeliveryList
    ).data;

  it('lets only owners register endpoints, and only safe URLs', async () => {
    const shop = await newMerchant();

    await http()
      .post('/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${shop.apiKey}`)
      .send({ url: `${baseUrl}/x` })
      .expect(403);
    const bad = await http()
      .post('/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${shop.token}`)
      .send({ url: 'https://169.254.169.254/latest/meta-data' })
      .expect(400);
    expect((bad.body as { code: string }).code).toBe('webhook_endpoint.invalid_url');

    const created = await addEndpoint(shop.token, '/owner');
    expect(created.secret).toMatch(/^whsec_/);
    const list = await http()
      .get('/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${shop.token}`);
    expect(JSON.stringify(list.body)).not.toContain(created.secret);
  });

  it('delivers a signed charge.succeeded that the documented snippet verifies', async () => {
    const shop = await newMerchant();
    const endpoint = await addEndpoint(shop.token, '/ok');

    const charge = await payCharge(shop.apiKey, shop.organizationId);

    const hit = await eventually(() =>
      Promise.resolve(merchant.received.find((r) => r.path === '/ok')),
    );
    const event = JSON.parse(hit.body) as WebhookEvent;
    expect(event).toMatchObject({
      type: 'charge.succeeded',
      data: {
        object: 'charge',
        id: charge.id,
        amount: '2500',
        currency: 'USD',
        reference: 'order-77',
      },
    });
    expect(hit.headers['po-event-id']).toBe(event.id);
    expect(verify(hit.body, String(hit.headers['po-signature']), endpoint.secret)).toBe(true);
    expect(verify(hit.body, String(hit.headers['po-signature']), 'whsec_wrong')).toBe(false);
    // Internal events (charge.created, charge.processing) are never sent.
    const types = merchant.received
      .filter((r) => r.path === '/ok')
      .map((r) => (JSON.parse(r.body) as WebhookEvent).type);
    expect(new Set(types)).toEqual(new Set(['charge.succeeded']));

    const [delivery] = await eventually(async () => {
      const list = await deliveriesOf(shop.token);
      return list[0]?.status === 'succeeded' && list;
    });
    expect(delivery).toMatchObject({ eventId: event.id, attemptCount: 1, lastStatusCode: 200 });
  });

  it('retries a failing endpoint with backoff and records every attempt', async () => {
    const shop = await newMerchant();
    await addEndpoint(shop.token, '/flaky');
    merchant.statuses.set('/flaky', [500, 503]);

    await payCharge(shop.apiKey, shop.organizationId);

    const [delivery] = await eventually(async () => {
      const list = await deliveriesOf(shop.token);
      return list[0]?.status === 'succeeded' && list;
    });
    const detail = (
      await http()
        .get(`/v1/webhook-deliveries/${delivery?.id}`)
        .set('Authorization', `Bearer ${shop.token}`)
        .expect(200)
    ).body as WebhookDeliveryDetail;
    expect(detail.attempts.map((a) => a.statusCode)).toEqual([500, 503, 200]);
    // Same event id on every retry: the merchant can deduplicate.
    const ids = merchant.received
      .filter((r) => r.path === '/flaky')
      .map((r) => r.headers['po-event-id']);
    expect(new Set(ids).size).toBe(1);
  });

  it('marks the delivery failed after the last allowed attempt', async () => {
    const shop = await newMerchant();
    await addEndpoint(shop.token, '/down');
    merchant.statuses.set('/down', [500, 500, 500, 500]);

    await payCharge(shop.apiKey, shop.organizationId);

    const [delivery] = await eventually(async () => {
      const list = await deliveriesOf(shop.token);
      return list[0]?.status === 'failed' && list;
    });
    expect(delivery).toMatchObject({ attemptCount: 3, lastStatusCode: 500 }); // WEBHOOK_MAX_ATTEMPTS=3
  });
});
