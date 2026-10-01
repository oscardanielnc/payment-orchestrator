import { HDKey } from '@scure/bip32';
import { AddressDeriver, type DerivedAddress } from '../../application/ports/address-deriver';
import type { CryptoNetwork } from '../../domain/network';
import { tronAddressFromPublicKey } from './tron-address';

/**
 * BIP-44 for TRON (coin type 195). The xpub is the account node m/44'/195'/0';
 * deposit address #i is its non-hardened child 0/i, i.e. m/44'/195'/0'/0/i.
 */
export class TronXpubAddressDeriver extends AddressDeriver {
  readonly network: CryptoNetwork = 'tron-nile';
  private readonly external: HDKey;

  constructor(xpub: string) {
    super();
    const account = HDKey.fromExtendedKey(xpub);
    if (account.privateKey) throw new Error('Deposit key must be an xpub, never a private key');
    this.external = account.deriveChild(0);
  }

  derive(index: number): DerivedAddress {
    const publicKey = this.external.deriveChild(index).publicKey;
    if (!publicKey) throw new Error(`Cannot derive address #${index}`);
    const { address, hex20 } = tronAddressFromPublicKey(publicKey);
    return { address, matchKey: hex20 };
  }
}
