import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import type { Queue } from 'bullmq';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { InboundEventHandler } from '../src/modules/inbound/application/ports/inbound-ports';
import { WEBHOOK_VERIFIERS } from '../src/modules/inbound/application/use-cases/receive-webhook.use-case';
import type { InboundEvent } from '../src/modules/inbound/domain/inbound-event';
import {
  HmacTimestampVerifier,
  signHmacTimestamp,
} from '../src/modules/inbound/infrastructure/signatures/hmac-timestamp.verifier';
import { PAYMENT_INBOUND_HANDLERS } from '../src/modules/payments/payments.module';
import { QUEUES } from '../src/shared/application/ports/job-queue';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp, eventually } from './setup/create-test-app';

const SECRET = 'whsec_test_placeholder'; // gitleaks:allow (fake test secret)

/** Records what it handled; fails on purpose for events whose body asks for it. */
class RecordingHandler extends InboundEventHandler {
  readonly provider = 'acme-psp';
  handled: string[] = [];
  failuresLeft = new Map<string, number>();

  handle(event: InboundEvent): Promise<void> {
    const left = this.failuresLeft.get(event.externalId) ?? 0;
    if (left > 0) {
      this.failuresLeft.set(event.externalId, left - 1);
      return Promise.reject(new Error(`provider timeout for ${event.externalId}`));
    }
    this.handled.push(event.externalId);
    return Promise.resolve();
  }
}

describe('Inbound webhooks, queues and the outbox relay (real Postgres + Redis)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const handler = new RecordingHandler();
  let seq = 0;

  beforeAll(async () => {
    app = await createTestApp({
      worker: true,
      customize: (builder) =>
        builder
          .overrideProvider(WEBHOOK_VERIFIERS)
          .useValue([new HmacTimestampVerifier('acme-psp', SECRET, { header: 'X-Signature' })])
          .overrideProvider(PAYMENT_INBOUND_HANDLERS)
          .useValue([handler]),
    });
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    handler.handled = [];
  });

  afterAll(async () => {
    await app.close();
  });

  const event = (id = `evt_${Date.now()}_${(seq += 1)}`) =>
    JSON.stringify({ id, type: 'payment.succeeded', data: { amount: '2500' } });
  const send = (
    body: string,
    signature = signHmacTimestamp(SECRET, body, Math.floor(Date.now() / 1000)),
  ) =>
    request(app.getHttpServer())
      .post('/v1/webhooks/acme-psp')
      .set('Content-Type', 'application/json')
      .set('X-Signature', signature)
      .send(body);
  const stored = (externalId: string) =>
    prisma.inboundEvent.findUnique({
      where: { provider_externalId: { provider: 'acme-psp', externalId } },
    });

  it('stores a signed webhook, answers fast and processes it in the background', async () => {
    const body = event('evt_fast');
    const started = Date.now();

    const response = await send(body).expect(200);

    expect(Date.now() - started).toBeLessThan(200);
    expect(response.body).toEqual({ received: true, duplicate: false });
    await eventually(async () => (await stored('evt_fast'))?.status === 'processed');
    expect(handler.handled).toEqual(['evt_fast']);
    expect((await stored('evt_fast'))?.payload).toBe(body); // raw bytes, untouched
  });

  it('applies an event delivered three times only once', async () => {
    const body = event('evt_dup');

    const responses = [await send(body), await send(body), await send(body)];

    expect(responses.map((r) => (r.body as { duplicate: boolean }).duplicate)).toEqual([
      false,
      true,
      true,
    ]);
    await eventually(async () => (await stored('evt_dup'))?.status === 'processed');
    expect(handler.handled.filter((id) => id === 'evt_dup')).toHaveLength(1);
    expect(await prisma.inboundEvent.count({ where: { externalId: 'evt_dup' } })).toBe(1);
  });

  it('rejects a tampered payload and stores nothing', async () => {
    const body = event('evt_tampered');
    const signature = signHmacTimestamp(SECRET, body, Math.floor(Date.now() / 1000));

    const response = await send(body.replace('2500', '999999'), signature).expect(400);

    expect(response.body).toMatchObject({ code: 'webhook.invalid_signature' });
    expect(await stored('evt_tampered')).toBeNull();
  });

  it('answers 404 for a provider without a webhook endpoint', async () => {
    await request(app.getHttpServer()).post('/v1/webhooks/nobody').send('{}').expect(404);
  });

  it('retries a failing event and processes it once the handler recovers', async () => {
    handler.failuresLeft.set('evt_flaky', 2);

    await send(event('evt_flaky')).expect(200);

    await eventually(async () => (await stored('evt_flaky'))?.status === 'processed');
    expect((await stored('evt_flaky'))?.attempts).toBe(2);
    expect(handler.handled).toContain('evt_flaky');
  });

  it('moves an event to the dead-letter queue after the last attempt', async () => {
    handler.failuresLeft.set('evt_broken', 99);

    await send(event('evt_broken')).expect(200);

    const failed = await eventually(async () => {
      const row = await stored('evt_broken');
      return row?.status === 'failed' ? row : null;
    });
    expect(failed).toMatchObject({ attempts: 3, lastError: 'provider timeout for evt_broken' });
    const deadLetter = app.get<Queue>(getQueueToken(QUEUES.deadLetter));
    const job = await eventually(() => deadLetter.getJob(`inbound-${failed.id}`));
    expect(job.data).toMatchObject({ queue: QUEUES.inboundEvents, attempts: 3 });
  });

  it('relays committed domain events from the outbox to the queue', async () => {
    const { token } = await app.get(CreateOrganizationUseCase).execute({ name: 'Relay Co' });
    const charge = (
      await request(app.getHttpServer())
        .post('/v1/charges')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `relay-${Date.now()}`)
        .send({ amount: '2500', currency: 'USD' })
        .expect(201)
    ).body as { id: string };

    const published = await eventually(async () => {
      const row = await prisma.outboxEvent.findFirst({ where: { aggregateId: charge.id } });
      return row?.publishedAt ? row : null;
    });
    expect(published.type).toBe('charge.created');
  });
});
