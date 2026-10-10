import { secp256k1 } from '@noble/curves/secp256k1.js';
import { HDKey } from '@scure/bip32';
import { bytesToHex } from 'viem';
import { publicKeyToAddress } from 'viem/accounts';
import { AddressDeriver, type DerivedAddress } from '../../application/ports/address-deriver';
import type { CryptoNetwork } from '../../domain/network';

/**
 * BIP-44 for EVM chains (coin type 60, shared by every EVM network). The xpub is the account
 * node m/44'/60'/0'; deposit address #i is m/44'/60'/0'/0/i, as in any Ethereum wallet.
 * Same curve and hash as TRON: only the encoding differs (0x + EIP-55 checksum, no base58).
 */
export class EvmXpubAddressDeriver extends AddressDeriver {
  private readonly external: HDKey;

  constructor(
    readonly network: CryptoNetwork,
    xpub: string,
  ) {
    super();
    const account = HDKey.fromExtendedKey(xpub);
    if (account.privateKey) throw new Error('Deposit key must be an xpub, never a private key');
    this.external = account.deriveChild(0);
  }

  derive(index: number): DerivedAddress {
    const publicKey = this.external.deriveChild(index).publicKey;
    if (!publicKey) throw new Error(`Cannot derive address #${index}`);
    // BIP-32 keys are compressed (33 B); the address hashes the uncompressed form (65 B).
    const uncompressed = secp256k1.Point.fromBytes(publicKey).toBytes(false);
    // keccak256(pubkey without 0x04) → last 20 bytes → EIP-55 checksum.
    const address = publicKeyToAddress(bytesToHex(uncompressed));
    return { address, matchKey: address.slice(2).toLowerCase() };
  }
}
