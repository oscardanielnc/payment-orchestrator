import type { INestApplication } from '@nestjs/common';
import type { Charge, PaymentAttempt, PaymentAttemptList } from '@po/contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { ENABLED_PAYMENT_PROVIDERS } from '../src/modules/payments/infrastructure/providers/enabled-providers.registry';
import { FakeCardProvider, FakeTronProvider } from '../src/modules/payments/testing/fake-providers';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from './setup/create-test-app';

describe('Payment attempts and routing (real Postgres, fake providers)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let acme: string;
  let globex: string;
  let seq = 0;
  const card = new FakeCardProvider();
  const tron = new FakeTronProvider();

  beforeAll(async () => {
    // Only Stripe and TRON are "configured": Mercado Pago and Base are unavailable.
    app = await createTestApp((builder) =>
      builder.overrideProvider(ENABLED_PAYMENT_PROVIDERS).useValue([card, tron]),
    );
    prisma = app.get(PrismaService);
    const create = app.get(CreateOrganizationUseCase);
    acme = (await create.execute({ name: 'Acme' })).token;
    globex = (await create.execute({ name: 'Globex' })).token;
  });

  afterAll(async () => {
    await app.close();
  });

  const key = () => `attempt-test-${Date.now()}-${(seq += 1)}`;
  const createCharge = async (amount: string, currency: string, token = acme) =>
    (
      await request(app.getHttpServer())
        .post('/v1/charges')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key())
        .send({ amount, currency })
        .expect(201)
    ).body as Charge;
  const startAttempt = (chargeId: string, method: string, token = acme) =>
    request(app.getHttpServer())
      .post(`/v1/charges/${chargeId}/attempts`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ method });

  it('routes usdt_tron + USDT to the TRON adapter and moves the charge to processing', async () => {
    const charge = await createCharge('10000000', 'USDT');

    const response = await startAttempt(charge.id, 'usdt_tron').expect(201);
    const attempt = response.body as PaymentAttempt;

    expect(attempt).toMatchObject({ provider: 'tron', status: 'pending', chargeId: charge.id });
    expect(attempt.instructions).toMatchObject({
      type: 'crypto_transfer',
      network: 'tron-nile',
      amount: '10000000',
    });
    expect(tron.calls.at(-1)?.attemptId).toBe(attempt.id);
    const stored = await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } });
    expect(stored.status).toBe('processing');
  });

  it('routes card + USD to Stripe', async () => {
    const charge = await createCharge('2500', 'USD');

    const attempt = (await startAttempt(charge.id, 'card').expect(201)).body as PaymentAttempt;

    expect(attempt.provider).toBe('stripe');
    expect(attempt.instructions.type).toBe('card_client_secret');
  });

  it('accepts a second attempt when the customer switches method, keeping both', async () => {
    const charge = await createCharge('2500', 'USD');
    await startAttempt(charge.id, 'card').expect(201);
    await startAttempt(charge.id, 'card').expect(201);

    const list = (
      await request(app.getHttpServer())
        .get(`/v1/charges/${charge.id}/attempts`)
        .set('Authorization', `Bearer ${acme}`)
        .expect(200)
    ).body as PaymentAttemptList;
    expect(list.data).toHaveLength(2);
  });

  it('answers 422 payment_method.unsupported for a method that does not take that currency', async () => {
    const charge = await createCharge('2500', 'USD');

    const response = await startAttempt(charge.id, 'usdt_tron').expect(422);

    expect(response.body).toMatchObject({ code: 'payment_method.unsupported' });
    const stored = await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } });
    expect(stored.status).toBe('pending'); // rolled back with the failed attempt
  });

  it('answers 422 payment_method.unavailable when the provider is not configured', async () => {
    const charge = await createCharge('10000000', 'USDC');

    const response = await startAttempt(charge.id, 'usdc_base').expect(422);
    expect(response.body).toMatchObject({ code: 'payment_method.unavailable' });
  });

  it("returns 404 for another organization's charge", async () => {
    const charge = await createCharge('2500', 'USD');

    const response = await startAttempt(charge.id, 'card', globex).expect(404);
    expect(response.body).toMatchObject({ code: 'charge.not_found' });
  });

  it('lets the database refuse a second succeeded attempt for the same charge', async () => {
    const charge = await createCharge('2500', 'USD');
    const first = (await startAttempt(charge.id, 'card').expect(201)).body as PaymentAttempt;
    const second = (await startAttempt(charge.id, 'card').expect(201)).body as PaymentAttempt;

    await prisma.paymentAttempt.update({ where: { id: first.id }, data: { status: 'succeeded' } });

    await expect(
      prisma.paymentAttempt.update({ where: { id: second.id }, data: { status: 'succeeded' } }),
    ).rejects.toThrow();
  });
});
