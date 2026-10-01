import type { CryptoNetwork } from '../../domain/network';

export interface DerivedAddress {
  address: string;
  matchKey: string;
}

/**
 * Deterministic address #index from a PUBLIC key only (ADR 0010):
 * the server can generate receiving addresses but can never spend from them.
 */
export abstract class AddressDeriver {
  abstract readonly network: CryptoNetwork;
  abstract derive(index: number): DerivedAddress;
}
