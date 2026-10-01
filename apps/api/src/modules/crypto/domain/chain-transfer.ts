import type { CryptoNetwork } from './network';

/** A confirmed (irreversible) token transfer read from the chain. */
export interface ChainTransfer {
  network: CryptoNetwork;
  txHash: string;
  /** Position of the event in its transaction: (txHash, eventIndex) is unique. */
  eventIndex: number;
  /** Network-independent lowercase hex key of the recipient, used to find the deposit address. */
  toMatchKey: string;
  fromMatchKey: string;
  /** Token minor units. */
  amount: bigint;
  blockNumber: bigint;
  blockTimestamp: Date;
}
