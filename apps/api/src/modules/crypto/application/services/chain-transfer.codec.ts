import type { ChainTransfer } from '../../domain/chain-transfer';
import type { CryptoNetwork } from '../../domain/network';

/** JSON form of a transfer for the inbound queue: bigints as strings, dates as ISO. */
export const chainTransferCodec = {
  externalId: (t: ChainTransfer) => `${t.txHash}:${t.eventIndex}`,

  encode(t: ChainTransfer): string {
    return JSON.stringify({
      ...t,
      amount: t.amount.toString(),
      blockNumber: t.blockNumber.toString(),
      blockTimestamp: t.blockTimestamp.toISOString(),
    });
  },

  decode(payload: string): ChainTransfer {
    const raw = JSON.parse(payload) as Record<string, string | number>;
    return {
      network: raw.network as CryptoNetwork,
      txHash: String(raw.txHash),
      eventIndex: Number(raw.eventIndex),
      toMatchKey: String(raw.toMatchKey),
      fromMatchKey: String(raw.fromMatchKey),
      amount: BigInt(raw.amount ?? ''),
      blockNumber: BigInt(raw.blockNumber ?? ''),
      blockTimestamp: new Date(String(raw.blockTimestamp)),
    };
  },
};
