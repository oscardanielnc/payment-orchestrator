import type { INestApplication } from '@nestjs/common';
import type { Charge, LedgerEntryList, PaymentAttempt } from '@po/contracts';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
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
import { IngestChainTransfersUseCase } from '../src/modules/payments/application/use-cases/ingest-chain-transfers.use-case';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp, eventually } from './setup/create-test-app';

const TEST_MNEMONIC = // gitleaks:allow (public BIP-39 test vector)
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const XPUB = HDKey.fromMasterSeed(mnemonicToSeedSync(TEST_MNEMONIC)).derive(
  "m/44'/60'/0'",
).publicExtendedKey;
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const CONFIRMATIONS = 12;

/** Stands in for a Base Sepolia RPC: the test mines blocks and decides which logs exist. */
class ScriptedChain implements EvmChainReader {
  head = 1_000n;
  logs: EvmTransferLog[] = [];

  chainId() {
    return Promise.resolve(84532);
  }
  headBlock() {
    return Promise.resolve(this.head);
  }
  transferLogs(_token: string, from: bigint, to: bigint) {
    return Promise.resolve(this.logs.filter((l) => l.blockNumber >= from && l.blockNumber <= to));
  }
  blockTimestamp() {
    return Promise.resolve(new Date());
  }
}

describe('USDC on Base Sepolia: same domain as TRON, EVM adapters (fake RPC, Postgres, Redis)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let seq = 0;
  const chain = new ScriptedChain();

  beforeAll(async () => {
    app = await createTestApp({
      worker: true,
      customize: (builder) =>
        builder.overrideProvider(CryptoNetworks).useValue(
          new ConfiguredCryptoNetworks({
            'base-sepolia': {
              deriver: new EvmXpubAddressDeriver('base-sepolia', XPUB),
              source: new EvmTransferSource('base-sepolia', {
                reader: chain,
                token: USDC,
                expectedChainId: 84532,
                confirmations: CONFIRMATIONS,
                pollIntervalMs: 60_000,
              }),
            },
          }),
        ),
      env: {
        BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
        BASE_SEPOLIA_CHAIN_ID: '84532',
        BASE_USDC_CONTRACT: USDC,
        BASE_DEPOSIT_XPUB: XPUB,
      },
    });
    prisma = app.get(PrismaService);
    token = (await app.get(CreateOrganizationUseCase).execute({ name: 'Base Shop' })).token;
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `base-${Date.now()}-${(seq += 1)}`)
      .send(body);

  async function openUsdcAttempt(amount = '2500000') {
    const charge = (await post('/v1/charges', { amount, currency: 'USDC' }).expect(201))
      .body as Charge;
    const attempt = (
      await post(`/v1/charges/${charge.id}/attempts`, { method: 'usdc_base' }).expect(201)
    ).body as PaymentAttempt;
    if (attempt.instructions.type !== 'crypto_transfer')
      throw new Error('expected crypto instructions');
    return { charge, attempt, address: attempt.instructions.address };
  }

  /** A customer's USDC transfer mined in the next block. */
  const pay = (address: string, value: bigint) => {
    chain.head += 1n;
    chain.logs.push({
      transactionHash: `0x${(seq += 1).toString(16).padStart(64, '0')}`,
      logIndex: 0,
      blockNumber: chain.head,
      from: '0x00000000000000000000000000000000000000aa',
      to: address,
      value,
    });
  };

  const tick = async () => {
    const result = await app.get(IngestChainTransfersUseCase).execute('base-sepolia');
    await eventually(
      async () =>
        (await prisma.inboundEvent.count({
          where: { provider: 'base-sepolia', status: 'received' },
        })) === 0,
    );
    return result;
  };
  const statusOf = async (chargeId: string) =>
    (await prisma.charge.findUniqueOrThrow({ where: { id: chargeId } })).status;

  it('gives each attempt its own checksummed 0x address derived from the xpub', async () => {
    const first = await openUsdcAttempt();
    const second = await openUsdcAttempt();

    expect(first.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(first.address).not.toBe(second.address);
    expect(first.attempt.instructions).toMatchObject({
      network: 'base-sepolia',
      token: 'USDC',
      amount: '2500000',
    });
  });

  it('pays only after the confirmations, exactly once, with the same ledger postings', async () => {
    await tick(); // first run: sets the cursor
    const { charge, address } = await openUsdcAttempt();
    pay(address, 2_500_000n);

    await tick();
    expect(await statusOf(charge.id)).toBe('processing'); // mined, not confirmed yet

    chain.head += BigInt(CONFIRMATIONS);
    expect(await tick()).toEqual({ relevant: 1, ingested: 1 });
    expect(await tick()).toEqual({ relevant: 0, ingested: 0 }); // cursor moved past it
    expect(await statusOf(charge.id)).toBe('succeeded');

    const { data } = (
      await request(app.getHttpServer())
        .get(`/v1/charges/${charge.id}/ledger-entries`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body as LedgerEntryList;
    expect(data.map((e) => `${e.direction} ${e.accountName} ${e.amount}`)).toEqual([
      'debit Deposits on base-sepolia 2500000',
      'credit Awaiting settlement 2500000',
      'debit Awaiting settlement 2500000',
      'credit Available 2500000',
    ]);
  });

  it('waits on an underpayment and pays when the rest arrives', async () => {
    const { charge, address } = await openUsdcAttempt();

    pay(address, 1_000_000n);
    chain.head += BigInt(CONFIRMATIONS);
    await tick();
    expect(await statusOf(charge.id)).toBe('processing');

    pay(address, 1_500_000n);
    chain.head += BigInt(CONFIRMATIONS);
    await tick();
    expect(await statusOf(charge.id)).toBe('succeeded');
  });
});
