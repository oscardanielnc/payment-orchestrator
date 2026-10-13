import type { INestApplication } from '@nestjs/common';
import type { Charge, CheckoutAttempt, CheckoutSession } from '@po/contracts';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExpireChargesUseCase } from '../src/modules/charges/application/use-cases/expire-charges.use-case';
import { CryptoNetworks } from '../src/modules/crypto/application/ports/crypto-networks';
import {
  TransferBatch,
  TransferSource,
} from '../src/modules/crypto/application/ports/transfer-source';
import type { ChainTransfer } from '../src/modules/crypto/domain/chain-transfer';
import type { CryptoNetwork } from '../src/modules/crypto/domain/network';
import { ConfiguredCryptoNetworks } from '../src/modules/crypto/infrastructure/configured-crypto-networks';
import { tronAddressToHex20 } from '../src/modules/crypto/infrastructure/tron/tron-address';
import { TronXpubAddressDeriver } from '../src/modules/crypto/infrastructure/tron/tron-xpub-address-deriver';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { IngestChainTransfersUseCase } from '../src/modules/payments/application/use-cases/ingest-chain-transfers.use-case';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp, eventually } from './setup/create-test-app';

const TEST_MNEMONIC = // gitleaks:allow (public BIP-39 test vector)
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const XPUB = HDKey.fromMasterSeed(mnemonicToSeedSync(TEST_MNEMONIC)).derive(
  "m/44'/195'/0'",
).publicExtendedKey;

class ScriptedTransferSource extends TransferSource {
  readonly network: CryptoNetwork = 'tron-nile';
  readonly pollIntervalMs = 10_000;
  balances = new Map<string, bigint>();

  tokenBalance(address: string): Promise<bigint> {
    return Promise.resolve(this.balances.get(address) ?? 0n);
  }
  transfers: ChainTransfer[] = [];

  fetchConfirmedSince(): Promise<TransferBatch> {
    return Promise.resolve({ transfers: this.transfers, cursor: String(Date.now()) });
  }
}

describe('Hosted checkout (public, real Postgres)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let apiKey: string;
  let seq = 0;
  const chain = new ScriptedTransferSource();

  beforeAll(async () => {
    app = await createTestApp({
      worker: true,
      customize: (builder) =>
        builder.overrideProvider(CryptoNetworks).useValue(
          new ConfiguredCryptoNetworks({
            'tron-nile': { deriver: new TronXpubAddressDeriver(XPUB), source: chain },
          }),
        ),
      env: {
        TRON_FULL_HOST: 'https://nile.trongrid.io',
        TRON_USDT_CONTRACT: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        TRON_DEPOSIT_XPUB: XPUB,
        CHECKOUT_BASE_URL: 'https://pay.example.test/pay/',
      },
    });
    prisma = app.get(PrismaService);
    apiKey = (await app.get(CreateOrganizationUseCase).execute({ name: 'Acme Coffee' })).token;
  });

  afterAll(async () => {
    await app.close();
  });

  const createCharge = async (body: object) =>
    (
      await request(app.getHttpServer())
        .post('/v1/charges')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Idempotency-Key', `checkout-${Date.now()}-${(seq += 1)}`)
        .send(body)
        .expect(201)
    ).body as Charge;
  const tokenOf = (charge: Charge) => charge.checkoutUrl.split('/').at(-1) ?? '';
  // Public endpoints: no Authorization header anywhere below.
  const view = (token: string) => request(app.getHttpServer()).get(`/v1/checkout/${token}`);
  const choose = (token: string, method: string) =>
    request(app.getHttpServer()).post(`/v1/checkout/${token}/attempts`).send({ method });

  it('links each charge to its checkout with an unguessable token, not its id', async () => {
    const charge = await createCharge({ amount: '10000000', currency: 'USDT' });

    expect(charge.checkoutUrl).toMatch(/^https:\/\/pay\.example\.test\/pay\/[\w-]{22}$/);
    expect(charge.checkoutUrl).not.toContain(charge.id);
  });

  it('shows the public view: merchant, amount, methods; never ids or the merchant reference', async () => {
    const charge = await createCharge({
      amount: '10000000',
      currency: 'USDT',
      description: 'Two flat whites',
      reference: 'order-4821',
    });

    const response = await view(tokenOf(charge)).expect(200);
    const session = response.body as CheckoutSession;

    expect(session).toEqual({
      merchantName: 'Acme Coffee',
      amount: '10000000',
      currency: 'USDT',
      description: 'Two flat whites',
      status: 'pending',
      expiresAt: charge.expiresAt,
      methods: ['usdt_tron'],
      attempt: null,
      stripePublishableKey: null,
    });
    expect(response.text).not.toContain(charge.id);
    expect(response.text).not.toContain('order-4821');
  });

  it('answers 404 for unknown and malformed tokens alike', async () => {
    await view('AAAAAAAAAAAAAAAAAAAAAA').expect(404);
    await view('not a token!').expect(404);
  });

  it('reuses the open attempt when the customer picks the same method again', async () => {
    const charge = await createCharge({ amount: '10000000', currency: 'USDT' });
    const token = tokenOf(charge);

    const first = (await choose(token, 'usdt_tron').expect(200)).body as CheckoutAttempt;
    const again = (await choose(token, 'usdt_tron').expect(200)).body as CheckoutAttempt;

    expect(again.instructions).toEqual(first.instructions);
    expect(await prisma.paymentAttempt.count({ where: { chargeId: charge.id } })).toBe(1);
    expect(first.instructions).toMatchObject({
      type: 'crypto_transfer',
      network: 'tron-nile',
      amount: '10000000',
    });
  });

  it('refuses a method that is not enabled for the currency', async () => {
    const charge = await createCharge({ amount: '2500', currency: 'USD' });

    const session = (await view(tokenOf(charge)).expect(200)).body as CheckoutSession;
    expect(session.methods).toEqual([]); // no Stripe in this environment

    await choose(tokenOf(charge), 'card').expect((r) =>
      expect(r.status).toBeGreaterThanOrEqual(400),
    );
  });

  it('turns succeeded on the page once the transfer is confirmed on chain', async () => {
    const charge = await createCharge({ amount: '10000000', currency: 'USDT' });
    const token = tokenOf(charge);
    const attempt = (await choose(token, 'usdt_tron').expect(200)).body as CheckoutAttempt;
    if (attempt.instructions.type !== 'crypto_transfer') throw new Error('expected crypto');

    chain.transfers = [
      {
        network: 'tron-nile',
        txHash: `tx-checkout-${(seq += 1)}`,
        eventIndex: 0,
        toMatchKey: tronAddressToHex20(attempt.instructions.address),
        fromMatchKey: 'ab'.repeat(20),
        amount: 10_000_000n,
        blockNumber: 71_454_804n,
        blockTimestamp: new Date(),
      },
    ];
    await app.get(IngestChainTransfersUseCase).execute('tron-nile');

    const paid = await eventually(async () => {
      const session = (await view(token)).body as CheckoutSession;
      return session.status === 'succeeded' && session;
    });
    expect(paid.attempt).toMatchObject({ method: 'usdt_tron', status: 'succeeded' });
    chain.transfers = [];
  });

  it('shows an expired link as expired, refuses payment, and the sweep stores it', async () => {
    const charge = await createCharge({ amount: '10000000', currency: 'USDT' });
    const token = tokenOf(charge);
    await prisma.charge.update({
      where: { id: charge.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(((await view(token).expect(200)).body as CheckoutSession).status).toBe('expired');
    const refused = await choose(token, 'usdt_tron');
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect((refused.body as { code: string }).code).toBe('charge.not_payable');

    await app.get(ExpireChargesUseCase).execute();
    const stored = await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } });
    expect(stored.status).toBe('expired');
  });
});
