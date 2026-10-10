import { describe, expect, it } from 'vitest';
import type { EvmChainReader, EvmTransferLog } from './evm-chain-reader';
import { EvmTransferSource } from './evm-transfer-source';

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

/** A chain at `head` whose Transfer logs are `logs`; records every eth_getLogs range asked. */
function fakeChain(head: bigint, logs: EvmTransferLog[] = [], chainId = 84532) {
  const ranges: [bigint, bigint][] = [];
  const reader: EvmChainReader = {
    chainId: () => Promise.resolve(chainId),
    headBlock: () => Promise.resolve(head),
    transferLogs: (_token, from, to) => {
      ranges.push([from, to]);
      return Promise.resolve(logs.filter((l) => l.blockNumber >= from && l.blockNumber <= to));
    },
    blockTimestamp: (block) => Promise.resolve(new Date(Number(block) * 2000)),
  };
  return { reader, ranges };
}

const source = (reader: EvmChainReader) =>
  new EvmTransferSource('base-sepolia', {
    reader,
    token: USDC,
    expectedChainId: 84532,
    confirmations: 12,
    pollIntervalMs: 10_000,
  });

const log = (blockNumber: bigint, logIndex = 3): EvmTransferLog => ({
  transactionHash: `0xAB${String(blockNumber)}`,
  logIndex,
  blockNumber,
  from: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  to: '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0',
  value: 1_500_000n,
});

describe('EvmTransferSource', () => {
  it('maps Transfer logs to transfers with bare lowercase hex keys', async () => {
    const { reader } = fakeChain(1000n, [log(950n)]);

    const batch = await source(reader).fetchConfirmedSince('900');

    expect(batch.transfers).toEqual([
      {
        network: 'base-sepolia',
        txHash: '0xab950',
        eventIndex: 3,
        toMatchKey: '6fac4d18c912343bf86fa7049364dd4e424ab9c0', // gitleaks:allow (public address, not a key)
        fromMatchKey: '9858effd232b4033e47d90003d41ec34ecaeda94', // gitleaks:allow (public address, not a key)
        amount: 1_500_000n,
        blockNumber: 950n,
        blockTimestamp: new Date(950 * 2000),
      },
    ]);
  });

  it('uses the timestamp the node puts in the log instead of asking for the block', async () => {
    const { reader } = fakeChain(1000n, [{ ...log(950n), blockTimestamp: new Date(42_000) }]);
    reader.blockTimestamp = () => Promise.reject(new Error('should not be called'));

    const batch = await source(reader).fetchConfirmedSince('900');

    expect(batch.transfers[0]?.blockTimestamp).toEqual(new Date(42_000));
  });

  it('reads only up to head minus confirmations and resumes right after the cursor', async () => {
    const { reader, ranges } = fakeChain(1000n, [log(988n), log(989n)]);

    const batch = await source(reader).fetchConfirmedSince('900');

    expect(ranges).toEqual([[901n, 988n]]);
    expect(batch.transfers.map((t) => t.blockNumber)).toEqual([988n]); // 989 has 11 on top
    expect(batch.cursor).toBe('988');
  });

  it('starts a little in the past on the first run', async () => {
    const { reader, ranges } = fakeChain(1000n);

    expect((await source(reader).fetchConfirmedSince(null)).cursor).toBe('988');
    expect(ranges).toEqual([
      [688n, 887n],
      [888n, 988n],
    ]);
  });

  it('asks nothing when no new block is confirmed yet', async () => {
    const { reader, ranges } = fakeChain(1000n);

    expect(await source(reader).fetchConfirmedSince('988')).toEqual({
      transfers: [],
      cursor: '988',
    });
    expect(ranges).toEqual([]);
  });

  it('splits long ranges into RPC-sized requests and catches up over several polls', async () => {
    const { reader, ranges } = fakeChain(20_000n);

    const batch = await source(reader).fetchConfirmedSince('0');

    expect(ranges).toHaveLength(10);
    expect(ranges[0]).toEqual([1n, 200n]);
    expect(batch.cursor).toBe('2000');
  });

  it('refuses an RPC that serves another chain', async () => {
    const { reader } = fakeChain(1000n, [], 1);

    await expect(source(reader).fetchConfirmedSince(null)).rejects.toThrow(
      /chain 1, expected 84532/,
    );
  });
});
