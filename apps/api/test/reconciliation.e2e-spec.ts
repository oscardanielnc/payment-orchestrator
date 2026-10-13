import type { INestApplication } from '@nestjs/common';
import type { Charge, PaymentAttempt, ReconciliationFindingList } from '@po/contracts';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import type Stripe from 'stripe';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CryptoNetworks } from '../src/modules/crypto/application/ports/crypto-networks';
import { ConfiguredCryptoNetworks } from '../src/modules/crypto/infrastructure/configured-crypto-networks';
import type {
  EvmChainReader,
  EvmTransferLog,
} from '../src/modules/crypto/infrastructure/evm/evm-chain-reader';
import { EvmTransferSource } from '../src/modules/crypto/infrastructure/evm/evm-transfer-source';
import { EvmXpubAddressDeriver } from '../src/modules/crypto/infrastructure/evm/evm-xpub-address-deriver';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { SettleChainTransferUseCase } from '../src/modules/payments/application/use-cases/settle-chain-transfer.use-case';
import { SettleProviderPaymentUseCase } from '../src/modules/payments/application/use-cases/settle-provider-payment.use-case';
import { STRIPE_CLIENT } from '../src/modules/payments/infrastructure/providers/stripe/stripe-client';
import { RunReconciliationUseCase } from '../src/modules/reconciliation/application/use-cases/run-reconciliation.use-case';
import { utcDay } from '../src/modules/reconciliation/domain/window';
import { Clock } from '../src/shared/application/ports/clock';
import { Money } from '../src/shared/domain/money';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from './setup/create-test-app';

const TEST_MNEMONIC = // gitleaks:allow (public BIP-39 test vector)
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const XPUB = HDKey.fromMasterSeed(mnemonicToSeedSync(TEST_MNEMONIC)).derive(
  "m/44'/60'/0'",
).publicExtendedKey;
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

/** Days no other test file writes to: the shared database stays out of these windows. */
const DAY_CLEAN = new Date('2020-03-01T10:00:00Z');
const DAY_BROKEN = new Date('2020-03-02T10:00:00Z');

class MovableClock extends Clock {
  current = DAY_CLEAN;
  now() {
    return this.current;
  }
}
const clock = new MovableClock();

/** A Base Sepolia RPC the test controls; balances come from the transfers it holds. */
class ScriptedChain implements EvmChainReader {
  head = 1_000n;
  logs: EvmTransferLog[] = [];
  chainId = () => Promise.resolve(84532);
  headBlock = () => Promise.resolve(this.head);
  transferLogs = (_t: string, from: bigint, to: bigint) =>
    Promise.resolve(this.logs.filter((l) => l.blockNumber >= from && l.blockNumber <= to));
  blockTimestamp = () => Promise.resolve(clock.now());
  tokenBalance = (_t: string, address: string) =>
    Promise.resolve(
      this.logs
        .filter((l) => l.to.toLowerCase() === address.toLowerCase())
        .reduce((sum, l) => sum + l.value, 0n),
    );
}

type FakeIntent = {
  id: string;
  status: Stripe.PaymentIntent.Status;
  amount_received: number;
  currency: string;
  metadata: Record<string, string>;
  created: number;
};

/** Stripe's PaymentIntents as a map the test can edit. */
const intents = new Map<string, FakeIntent>();
const fakeStripe = {
  paymentIntents: {
    create(params: Stripe.PaymentIntentCreateParams) {
      const id = `pi_recon_${intents.size + 1}_${Date.now()}`;
      intents.set(id, {
        id,
        status: 'requires_payment_method',
        amount_received: 0,
        currency: params.currency,
        metadata: params.metadata as Record<string, string>,
        created: Math.floor(clock.now().getTime() / 1000),
      });
      return Promise.resolve({ id, client_secret: `${id}_secret` });
    },
    retrieve: (id: string) => Promise.resolve(intents.get(id)),
    list(params: { created: { gte: number; lt: number } }) {
      const inRange = [...intents.values()].filter(
        (i) => i.created >= params.created.gte && i.created < params.created.lt,
      );
      return { autoPagingToArray: () => Promise.resolve(inRange) };
    },
  },
};

describe('Reconciliation: providers vs ledger (fake Stripe, scripted chain, Postgres)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let seq = 0;
  const chain = new ScriptedChain();

  beforeAll(async () => {
    app = await createTestApp({
      env: {
        STRIPE_SECRET_KEY: 'sk_test_placeholder', // gitleaks:allow (fake test-mode key)
        STRIPE_WEBHOOK_SECRET: 'whsec_recon_placeholder', // gitleaks:allow (fake test secret)
        STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder', // gitleaks:allow (fake test-mode key)
        BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
        BASE_SEPOLIA_CHAIN_ID: '84532',
        BASE_USDC_CONTRACT: USDC,
        BASE_DEPOSIT_XPUB: XPUB,
      },
      customize: (builder) =>
        builder
          .overrideProvider(Clock)
          .useValue(clock)
          .overrideProvider(STRIPE_CLIENT)
          .useValue(fakeStripe)
          .overrideProvider(CryptoNetworks)
          .useValue(
            new ConfiguredCryptoNetworks({
              'base-sepolia': {
                deriver: new EvmXpubAddressDeriver('base-sepolia', XPUB),
                source: new EvmTransferSource('base-sepolia', {
                  reader: chain,
                  token: USDC,
                  expectedChainId: 84532,
                  confirmations: 1,
                  pollIntervalMs: 60_000,
                }),
              },
            }),
          ),
    });
    prisma = app.get(PrismaService);
    token = (await app.get(CreateOrganizationUseCase).execute({ name: 'Recon Shop' })).token;
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `recon-${Date.now()}-${(seq += 1)}`)
      .send(body);

  async function attempt(currency: 'USD' | 'USDC', method: 'card' | 'usdc_base', amount: string) {
    const charge = (await post('/v1/charges', { amount, currency }).expect(201)).body as Charge;
    const created = (await post(`/v1/charges/${charge.id}/attempts`, { method }).expect(201))
      .body as PaymentAttempt;
    const stored = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.id } });
    return { chargeId: charge.id, reference: stored.externalReference };
  }

  /**
   * A customer sends USDC: the chain has it at once; our ledger only once `record` applies it,
   * through the same use case the watcher's queue uses. (The watcher itself is left out: its
   * cursor is shared with the other Base test file running in parallel.)
   */
  const sendUsdc = (address: string, value: bigint) => {
    chain.head += 1n;
    const log: EvmTransferLog = {
      transactionHash: `0x${(seq += 1).toString(16).padStart(64, '0')}`,
      logIndex: 0,
      blockNumber: chain.head,
      from: '0x00000000000000000000000000000000000000aa',
      to: address,
      value,
    };
    chain.logs.push(log);
    return log;
  };
  const record = (log: EvmTransferLog) =>
    app.get(SettleChainTransferUseCase).execute({
      network: 'base-sepolia',
      txHash: log.transactionHash,
      eventIndex: log.logIndex,
      toMatchKey: log.to.toLowerCase().slice(2),
      fromMatchKey: log.from.toLowerCase().slice(2),
      amount: log.value,
      blockNumber: log.blockNumber,
      blockTimestamp: clock.now(),
    });
  /** Stripe captured it; `webhook` decides whether we heard about it. */
  const captureCard = async (pi: string, amount: number, webhook: boolean) => {
    intents.set(pi, { ...intents.get(pi)!, status: 'succeeded', amount_received: amount });
    if (webhook) {
      await app.get(SettleProviderPaymentUseCase).execute({
        provider: 'stripe',
        externalReference: pi,
        outcome: { kind: 'succeeded', amount: Money.of(BigInt(amount), 'USD') },
      });
    }
  };
  const reconcile = (source: string, day: Date) =>
    app.get(RunReconciliationUseCase).execute({ source, window: utcDay(day) });

  it('a clean day produces zero findings', async () => {
    clock.current = DAY_CLEAN;
    const crypto = await attempt('USDC', 'usdc_base', '2500000');
    await record(sendUsdc(crypto.reference, 2_500_000n));
    const card = await attempt('USD', 'card', '1500');
    await captureCard(card.reference, 1500, true);

    expect(await reconcile('base-sepolia', DAY_CLEAN)).toMatchObject({
      matched: 1,
      discrepancies: 0,
    });
    expect(await reconcile('stripe', DAY_CLEAN)).toMatchObject({ matched: 1, discrepancies: 0 });
  });

  describe('a day with injected mismatches', () => {
    const subjects: Record<string, string> = {};
    let unreadTransfer: EvmTransferLog;

    beforeAll(async () => {
      clock.current = DAY_BROKEN;
      // 1. USDC reached our address but the watcher never read it.
      const unread = await attempt('USDC', 'usdc_base', '1000000');
      unreadTransfer = sendUsdc(unread.reference, 1_000_000n);
      subjects.unreadTransfer = `deposits:base-sepolia:${unread.chargeId}`;
      // 2. Stripe captured a card payment; its webhook was lost.
      const lost = await attempt('USD', 'card', '700');
      await captureCard(lost.reference, 700, false);
      subjects.lostWebhook = `provider-payment:stripe:${lost.reference}`;
      // 3. Recorded by us, but Stripe now says it was captured for less (e.g. edited by hand).
      const partial = await attempt('USD', 'card', '900');
      await captureCard(partial.reference, 900, true);
      intents.set(partial.reference, { ...intents.get(partial.reference)!, amount_received: 600 });
      subjects.amountDiffers = `provider-payment:stripe:${partial.reference}`;
      // 4. Recorded by us, but the intent is not succeeded at Stripe.
      const ghost = await attempt('USD', 'card', '400');
      await captureCard(ghost.reference, 400, true);
      intents.set(ghost.reference, { ...intents.get(ghost.reference)!, status: 'canceled' });
      subjects.ghost = `provider-payment:stripe:${ghost.reference}`;
    });

    const findings = async () =>
      new Map(
        (await prisma.reconciliationFinding.findMany({ where: { firstSeenAt: DAY_BROKEN } })).map(
          (f) => [f.subject, f],
        ),
      );

    it('reports each injected mismatch as a finding with its type', async () => {
      expect(await reconcile('base-sepolia', DAY_BROKEN)).toMatchObject({ discrepancies: 1 });
      expect(await reconcile('stripe', DAY_BROKEN)).toMatchObject({ discrepancies: 3 });

      const found = await findings();
      expect(found.get(subjects.unreadTransfer!)).toMatchObject({
        kind: 'missing_in_ledger',
        status: 'open',
      });
      expect(found.get(subjects.lostWebhook!)?.kind).toBe('missing_in_ledger');
      expect(found.get(subjects.amountDiffers!)).toMatchObject({ kind: 'amount_mismatch' });
      expect(found.get(subjects.amountDiffers!)?.providerAmount.toFixed(0)).toBe('600');
      expect(found.get(subjects.ghost!)?.kind).toBe('missing_at_provider');
    });

    it('gives the same result when the same window runs twice', async () => {
      const before = await findings();

      expect(await reconcile('stripe', DAY_BROKEN)).toMatchObject({ discrepancies: 3, opened: 0 });
      expect(await reconcile('base-sepolia', DAY_BROKEN)).toMatchObject({ opened: 0 });

      const after = await findings();
      expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
      const runs = await prisma.reconciliationRun.count({
        where: { windowStart: utcDay(DAY_BROKEN).from },
      });
      expect(runs).toBe(2); // one per source, overwritten
    });

    it('clears a finding once the watcher catches up, without touching the ledger itself', async () => {
      await record(unreadTransfer);
      await reconcile('base-sepolia', DAY_BROKEN);

      expect((await findings()).get(subjects.unreadTransfer!)?.status).toBe('cleared');
    });

    it('shows merchants their findings; resolving needs a signed-in owner', async () => {
      const list = (
        await request(app.getHttpServer())
          .get('/v1/reconciliation/findings?status=open')
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
      ).body as ReconciliationFindingList;
      expect(list.data.map((f) => f.kind).sort()).toEqual([
        'amount_mismatch',
        'missing_at_provider',
        'missing_in_ledger',
      ]);

      await request(app.getHttpServer())
        .post(`/v1/reconciliation/findings/${list.data[0]!.id}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ note: 'API keys cannot sign off' })
        .expect(403);
    });
  });
});
