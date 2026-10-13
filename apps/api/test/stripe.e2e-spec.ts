import type { INestApplication } from '@nestjs/common';
import type { BalanceList, Charge, LedgerEntryList, PaymentAttempt } from '@po/contracts';
import Stripe from 'stripe';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { SyncProviderPaymentsUseCase } from '../src/modules/payments/application/use-cases/sync-provider-payments.use-case';
import { STRIPE_CLIENT } from '../src/modules/payments/infrastructure/providers/stripe/stripe-client';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp, eventually } from './setup/create-test-app';

const SECRET_KEY = 'sk_test_placeholder'; // gitleaks:allow (fake test-mode key)
const WEBHOOK_SECRET = 'whsec_e2e_placeholder'; // gitleaks:allow (fake test secret)

/** Stands in for Stripe's API: PaymentIntents are created locally, no network. */
const fakeStripe = {
  created: [] as { params: Stripe.PaymentIntentCreateParams; idempotencyKey?: string }[],
  paymentIntents: {
    create(params: Stripe.PaymentIntentCreateParams, options: Stripe.RequestOptions) {
      fakeStripe.created.push({ params, idempotencyKey: options.idempotencyKey });
      const id = `pi_test_${fakeStripe.created.length}_${Date.now()}`;
      return Promise.resolve({ id, client_secret: `${id}_secret_test` });
    },
    retrieve(id: string) {
      const status = fakeStripe.statuses.get(id) ?? 'requires_payment_method';
      return Promise.resolve({ id, status, amount_received: 2500, currency: 'usd', metadata: {} });
    },
    list() {
      return { autoPagingToArray: () => Promise.resolve([]) };
    },
  },
  /** What Stripe would answer for an intent whose webhook never reached us. */
  statuses: new Map<string, Stripe.PaymentIntent.Status>(),
};

describe('Stripe card payments (fake Stripe API, real webhooks signature, Postgres, Redis)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let seq = 0;
  const signer = new Stripe(SECRET_KEY);

  beforeAll(async () => {
    app = await createTestApp({
      worker: true,
      env: {
        STRIPE_SECRET_KEY: SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder', // gitleaks:allow (fake test-mode key)
      },
      customize: (builder) => builder.overrideProvider(STRIPE_CLIENT).useValue(fakeStripe),
    });
    prisma = app.get(PrismaService);
    token = (await app.get(CreateOrganizationUseCase).execute({ name: 'Card Shop' })).token;
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `stripe-${Date.now()}-${(seq += 1)}`)
      .send(body);
  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`).expect(200);

  async function openCardAttempt(amount = '2500') {
    const charge = (await post('/v1/charges', { amount, currency: 'USD' }).expect(201))
      .body as Charge;
    const attempt = (
      await post(`/v1/charges/${charge.id}/attempts`, { method: 'card' }).expect(201)
    ).body as PaymentAttempt;
    const intentId = (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }))
      .externalReference;
    return { charge, attempt, intentId };
  }

  /** A Stripe event as Stripe sends it, signed with the endpoint secret. */
  async function deliver(
    type: string,
    intentId: string,
    extra: Record<string, unknown> = {},
    eventId?: string,
  ) {
    const payload = JSON.stringify({
      id: eventId ?? `evt_test_${(seq += 1)}_${Date.now()}`,
      object: 'event',
      type,
      data: { object: { id: intentId, object: 'payment_intent', currency: 'usd', ...extra } },
    });
    const signature = signer.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    await request(app.getHttpServer())
      .post('/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature)
      .send(payload)
      .expect(200);
    return JSON.parse(payload) as { id: string };
  }

  const settled = (eventId: string) =>
    eventually(async () => {
      const row = await prisma.inboundEvent.findFirst({
        where: { provider: 'stripe', externalId: eventId },
      });
      return row && row.status !== 'received' ? row : null;
    });
  const chargeStatus = async (id: string) =>
    (await prisma.charge.findUniqueOrThrow({ where: { id } })).status;

  it('creates a card-only PaymentIntent with our ids and returns its client secret', async () => {
    const { charge, attempt } = await openCardAttempt();

    expect(attempt.provider).toBe('stripe');
    expect(attempt.instructions).toMatchObject({ type: 'card_client_secret' });
    expect(fakeStripe.created.at(-1)).toMatchObject({
      params: {
        amount: 2500,
        currency: 'usd',
        metadata: { chargeId: charge.id, attemptId: attempt.id },
      },
      idempotencyKey: attempt.id,
    });
  });

  it('settles payment_intent.succeeded: charge paid and Dr receivable / Cr available', async () => {
    const { charge, attempt, intentId } = await openCardAttempt();

    await settled(
      (await deliver('payment_intent.succeeded', intentId, { amount_received: 2500 })).id,
    );

    expect(await chargeStatus(charge.id)).toBe('succeeded');
    expect(
      (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status,
    ).toBe('succeeded');
    const { data } = (await get(`/v1/charges/${charge.id}/ledger-entries`)).body as LedgerEntryList;
    expect(data.map((e) => `${e.direction} ${e.accountName} ${e.amount}`)).toEqual([
      'debit Receivable from stripe 2500',
      'credit Available 2500',
    ]);
  });

  it('applies a webhook Stripe delivers twice only once', async () => {
    const { charge, intentId } = await openCardAttempt();
    const eventId = `evt_twice_${Date.now()}`;

    await deliver('payment_intent.succeeded', intentId, { amount_received: 2500 }, eventId);
    await deliver('payment_intent.succeeded', intentId, { amount_received: 2500 }, eventId);
    await settled(eventId);

    const { data } = (await get(`/v1/charges/${charge.id}/ledger-entries`)).body as LedgerEntryList;
    expect(new Set(data.map((e) => e.transactionId)).size).toBe(1);
  });

  it('keeps the charge open after a decline, and pays when the customer retries', async () => {
    const { charge, attempt, intentId } = await openCardAttempt();

    await settled(
      (
        await deliver('payment_intent.payment_failed', intentId, {
          last_payment_error: { code: 'card_declined', decline_code: 'generic_decline' },
        })
      ).id,
    );
    expect(await chargeStatus(charge.id)).toBe('processing');
    const declined = (await get(`/v1/charges/${charge.id}/attempts`)).body as {
      data: PaymentAttempt[];
    };
    expect(declined.data.find((a) => a.id === attempt.id)).toMatchObject({
      status: 'pending',
      failureReason: 'generic_decline',
    });

    await settled(
      (await deliver('payment_intent.succeeded', intentId, { amount_received: 2500 })).id,
    );
    expect(await chargeStatus(charge.id)).toBe('succeeded');
  });

  it('fails the charge when its only PaymentIntent is canceled', async () => {
    const { charge, attempt, intentId } = await openCardAttempt();

    await settled((await deliver('payment_intent.canceled', intentId)).id);

    expect(await chargeStatus(charge.id)).toBe('failed');
    expect(
      (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status,
    ).toBe('failed');
  });

  it('refuses to settle a different amount and sends the event to the dead-letter queue', async () => {
    const { charge, intentId } = await openCardAttempt();

    const event = await settled(
      (await deliver('payment_intent.succeeded', intentId, { amount_received: 99 })).id,
    );

    expect(event).toMatchObject({ status: 'failed' });
    expect(event.lastError).toContain('expects 2500 USD');
    expect(await chargeStatus(charge.id)).toBe('processing');
  });

  it('settles a payment whose webhook never arrived by asking Stripe', async () => {
    const { charge, attempt, intentId } = await openCardAttempt();
    fakeStripe.statuses.set(intentId, 'succeeded');
    // Pretend the webhook has been silent for 3 minutes.
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { updatedAt: new Date(Date.now() - 3 * 60_000) },
    });

    await app.get(SyncProviderPaymentsUseCase).execute();

    expect(await chargeStatus(charge.id)).toBe('succeeded');
    // The late webhook changes nothing: the payment is posted once.
    await settled(
      (await deliver('payment_intent.succeeded', intentId, { amount_received: 2500 })).id,
    );
    const { data } = (await get(`/v1/charges/${charge.id}/ledger-entries`)).body as LedgerEntryList;
    expect(data).toHaveLength(2);
  });

  it('ignores PaymentIntents it did not create', async () => {
    const event = await settled(
      (await deliver('payment_intent.succeeded', 'pi_from_dashboard', { amount_received: 1 })).id,
    );

    expect(event.status).toBe('processed');
  });

  it('rejects a webhook signed with another secret', async () => {
    const payload = JSON.stringify({
      id: 'evt_forged',
      type: 'payment_intent.succeeded',
      data: { object: {} },
    });
    await request(app.getHttpServer())
      .post('/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set(
        'Stripe-Signature',
        signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_wrong' }),
      )
      .send(payload)
      .expect(400);
  });

  it('exposes the merchant balance built from card payments', async () => {
    const balances = (await get('/v1/balances')).body as BalanceList;
    expect(balances.data.find((b) => b.name === 'Available' && b.currency === 'USD')?.posted).toBe(
      '10000',
    );
  });
});
