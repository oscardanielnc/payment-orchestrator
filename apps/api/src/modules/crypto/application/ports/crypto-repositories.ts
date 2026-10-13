import type { ChainTransfer } from '../../domain/chain-transfer';
import type { DepositAddress } from '../../domain/deposit-address';
import type { CryptoNetwork } from '../../domain/network';

export abstract class DepositAddressRepository {
  /** Next unused derivation index for the network (a database sequence: never reused). */
  abstract nextDerivationIndex(network: CryptoNetwork): Promise<number>;
  /** Inserts or updates with optimistic locking. */
  abstract save(deposit: DepositAddress): Promise<void>;
  abstract findByMatchKeys(network: CryptoNetwork, matchKeys: string[]): Promise<DepositAddress[]>;
  abstract findByMatchKey(network: CryptoNetwork, matchKey: string): Promise<DepositAddress | null>;
  abstract listCreatedBetween(
    network: CryptoNetwork,
    from: Date,
    to: Date,
  ): Promise<DepositAddress[]>;
  abstract listForCharges(network: CryptoNetwork, chargeIds: string[]): Promise<DepositAddress[]>;
}

export abstract class ChainTransferRepository {
  /** Stores the transfer once. Returns false if (network, txHash, eventIndex) was already seen. */
  abstract recordIfNew(transfer: ChainTransfer, depositAddressId: string): Promise<boolean>;
}

export abstract class WatcherCursorRepository {
  abstract get(network: CryptoNetwork): Promise<string | null>;
  abstract set(network: CryptoNetwork, cursor: string): Promise<void>;
}
