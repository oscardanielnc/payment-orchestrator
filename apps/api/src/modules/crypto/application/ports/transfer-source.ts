import type { ChainTransfer } from '../../domain/chain-transfer';
import type { CryptoNetwork } from '../../domain/network';

export interface TransferBatch {
  transfers: ChainTransfer[];
  /** Where to resume next time. Re-reading a little is fine: transfers are deduplicated. */
  cursor: string;
  /** True when the source stopped short of the chain head: the worker reads again soon. */
  behind?: boolean;
}

/** Reads confirmed (final) transfers of the watched token from a chain (ADR 0010). */
export abstract class TransferSource {
  abstract readonly network: CryptoNetwork;
  /** How often the worker polls this network. */
  abstract readonly pollIntervalMs: number;
  abstract fetchConfirmedSince(cursor: string | null): Promise<TransferBatch>;
  /** Current balance of the watched token at an address, in minor units (reconciliation). */
  abstract tokenBalance(address: string): Promise<bigint>;
}
