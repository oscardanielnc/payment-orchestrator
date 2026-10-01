import type { INestApplication } from '@nestjs/common';
import type { Charge, PaymentAttempt } from '@po/contracts';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import { ProcessChainTransfersUseCase } from '../src/modules/payments/application/use-cases/process-chain-transfers.use-case';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from './setup/create-test-app';

const TEST_MNEMONIC = // gitleaks:allow (public BIP-39 test vector)
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const XPUB = HDKey.fromMasterSeed(mnemonicToSeedSync(TEST_MNEMONIC)).derive(
  "m/44'/195'/0'",
).publicExtendedKey;

/** Stands in for TronGrid: the test decides which confirmed transfers "exist". */
class ScriptedTransferSource extends TransferSource {
  readonly network: CryptoNetwork = 'tron-nile';
  transfers: ChainTransfer[] = [];

  fetchConfirmedSince(): Promise<TransferBatch> {
    return Promise.resolve({ transfers: this.transfers, cursor: String(Date.now()) });
  }
}

describe('USDT on TRON: attempt → deposit address → confirmed transfer → paid', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let seq = 0;
  const chain = new ScriptedTransferSource();

  beforeAll(async () => {
    app = await createTestApp(
      (builder) =>
        builder.overrideProvider(CryptoNetworks).useValue(
          new ConfiguredCryptoNetworks({
            'tron-nile': { deriver: new TronXpubAddressDeriver(XPUB), source: chain },
          }),
        ),
      {
        TRON_FULL_HOST: 'https://nile.trongrid.io',
        TRON_USDT_CONTRACT: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        TRON_DEPOSIT_XPUB: XPUB,
      },
    );
    prisma = app.get(PrismaService);
    token = (await app.get(CreateOrganizationUseCase).execute({ name: 'Acme' })).token;
  });

  beforeEach(() => {
    chain.transfers = [];
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `tron-${Date.now()}-${(seq += 1)}`)
      .send(body);

  async function openUsdtAttempt(amount = '10000000') {
    const charge = (await post('/v1/charges', { amount, currency: 'USDT' }).expect(201))
      .body as Charge;
    const attempt = (
      await post(`/v1/charges/${charge.id}/attempts`, { method: 'usdt_tron' }).expect(201)
    ).body as PaymentAttempt;
    if (attempt.instructions.type !== 'crypto_transfer')
      throw new Error('expected crypto instructions');
    return { charge, attempt, address: attempt.instructions.address };
  }

  const transferTo = (address: string, amount: bigint): ChainTransfer => ({
    network: 'tron-nile',
    txHash: `tx-${(seq += 1)}`,
    eventIndex: 0,
    toMatchKey: tronAddressToHex20(address),
    fromMatchKey: 'ab'.repeat(20),
    amount,
    blockNumber: 71_454_804n,
    blockTimestamp: new Date(),
  });

  const tick = () => app.get(ProcessChainTransfersUseCase).execute('tron-nile');
  const statusOf = async (chargeId: string) =>
    (await prisma.charge.findUniqueOrThrow({ where: { id: chargeId } })).status;

  it('gives each attempt its own address derived from the xpub', async () => {
    const first = await openUsdtAttempt();
    const second = await openUsdtAttempt();

    expect(first.address).toMatch(/^T[1-9A-HJ-NP-Za-km-z]{33}$/);
    expect(first.address).not.toBe(second.address);
    expect(first.attempt.instructions).toMatchObject({
      network: 'tron-nile',
      token: 'USDT',
      amount: '10000000',
    });
  });

  it('marks the charge and the attempt succeeded on an exact payment, exactly once', async () => {
    const { charge, attempt, address } = await openUsdtAttempt();
    chain.transfers = [transferTo(address, 10_000_000n)];

    expect(await tick()).toEqual({ relevant: 1, applied: 1, paid: 1 });
    expect(await tick()).toEqual({ relevant: 1, applied: 0, paid: 0 }); // same transfer again

    expect(await statusOf(charge.id)).toBe('succeeded');
    const stored = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(stored.status).toBe('succeeded');
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: charge.id } });
    expect(events.map((e) => e.type)).toEqual([
      'charge.created',
      'charge.processing',
      'charge.succeeded',
    ]);
  });

  it('waits on an underpayment and pays when the rest arrives', async () => {
    const { charge, address } = await openUsdtAttempt();

    chain.transfers = [transferTo(address, 4_000_000n)];
    await tick();
    expect(await statusOf(charge.id)).toBe('processing');

    chain.transfers = [transferTo(address, 6_000_000n)];
    await tick();
    expect(await statusOf(charge.id)).toBe('succeeded');
  });

  it('accepts an overpayment and records the full amount received', async () => {
    const { charge, address } = await openUsdtAttempt();
    chain.transfers = [transferTo(address, 12_500_000n)];

    await tick();

    expect(await statusOf(charge.id)).toBe('succeeded');
    const deposit = await prisma.depositAddress.findFirstOrThrow({ where: { address } });
    expect(deposit.receivedAmount.toFixed(0)).toBe('12500000');
  });

  it('ignores transfers to addresses that are not ours', async () => {
    chain.transfers = [{ ...transferTo('TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf', 1n) }];

    expect(await tick()).toEqual({ relevant: 0, applied: 0, paid: 0 });
  });
});
