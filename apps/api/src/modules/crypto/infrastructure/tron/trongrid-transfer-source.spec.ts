import { afterEach, describe, expect, it, vi } from 'vitest';
import { TronGridTransferSource } from './trongrid-transfer-source';

// Shape copied from a real Nile response (2026-10-01).
const event = (index: number, timestamp: number) => ({
  block_number: 71454804 + index,
  block_timestamp: timestamp,
  event_index: 0,
  event_name: 'Transfer',
  result: {
    from: '0x4e01f8afe9cb37c0f4240b95cad967b4fb5aaa64',
    to: '0x57B09E87BFAA24E2BC52077EC3E5406B5AEA2844',
    value: '7000001',
  },
  transaction_id: `tx-${index}`,
});

const source = new TronGridTransferSource({
  fullHost: 'https://nile.trongrid.io',
  usdtContract: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
  apiKey: undefined,
  pollIntervalMs: 10_000,
  now: () => 1_790_900_000_000,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TronGridTransferSource', () => {
  it('maps events to transfers with bare lowercase hex recipients and bigint amounts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ data: [event(1, 1_790_899_800_000)], meta: {} }));
    vi.stubGlobal('fetch', fetchMock);

    const batch = await source.fetchConfirmedSince(null);

    expect(batch.transfers).toEqual([
      expect.objectContaining({
        txHash: 'tx-1',
        toMatchKey: '57b09e87bfaa24e2bc52077ec3e5406b5aea2844', // gitleaks:allow (public Nile address)
        amount: 7_000_001n,
      }),
    ]);
    expect(batch.cursor).toBe('1790899800000');
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('only_confirmed=true');
    expect(url).toContain('/v1/contracts/TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf/events');
  });

  it('re-reads one minute before the cursor and never moves the cursor backwards', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [], meta: {} }));
    vi.stubGlobal('fetch', fetchMock);

    const batch = await source.fetchConfirmedSince('1790892141000');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('min_block_timestamp=1790892081000');
    expect(batch.cursor).toBe('1790892141000');
  });

  it('fails loudly on an HTTP error so the tick is retried', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('busy', { status: 503 })));

    await expect(source.fetchConfirmedSince(null)).rejects.toThrow('503');
  });
});
