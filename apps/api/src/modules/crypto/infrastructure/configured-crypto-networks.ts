import type { AddressDeriver } from '../application/ports/address-deriver';
import { CryptoNetworks } from '../application/ports/crypto-networks';
import type { TransferSource } from '../application/ports/transfer-source';
import type { CryptoNetwork } from '../domain/network';

export interface NetworkAdapters {
  deriver: AddressDeriver;
  source: TransferSource;
}

/** Built from configuration: a network without its config is simply absent. */
export class ConfiguredCryptoNetworks extends CryptoNetworks {
  constructor(private readonly adapters: Partial<Record<CryptoNetwork, NetworkAdapters>>) {
    super();
  }

  enabled(): CryptoNetwork[] {
    return Object.keys(this.adapters) as CryptoNetwork[];
  }

  deriver(network: CryptoNetwork): AddressDeriver {
    return this.get(network).deriver;
  }

  source(network: CryptoNetwork): TransferSource {
    return this.get(network).source;
  }

  private get(network: CryptoNetwork): NetworkAdapters {
    const adapters = this.adapters[network];
    if (!adapters) throw new Error(`Crypto network ${network} is not configured`);
    return adapters;
  }
}
