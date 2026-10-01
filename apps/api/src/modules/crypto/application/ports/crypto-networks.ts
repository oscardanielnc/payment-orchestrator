import type { CryptoNetwork } from '../../domain/network';
import type { AddressDeriver } from './address-deriver';
import type { TransferSource } from './transfer-source';

/** The networks configured in this environment, with their deriver and transfer source. */
export abstract class CryptoNetworks {
  abstract enabled(): CryptoNetwork[];
  /** Throws if the network is not configured. */
  abstract deriver(network: CryptoNetwork): AddressDeriver;
  abstract source(network: CryptoNetwork): TransferSource;
}
