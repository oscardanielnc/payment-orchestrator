import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { createBase58check, hex } from '@scure/base';

const base58check = createBase58check(sha256);
const TRON_PREFIX = 0x41;

/**
 * TRON address from a secp256k1 public key — same as Ethereum, plus a prefix and base58:
 *
 *   uncompressed pubkey (65 B) → drop 0x04 → keccak256 → last 20 bytes   (= EVM address body)
 *   → prepend 0x41 → base58check                                          (= "T..." address)
 */
export function tronAddressFromPublicKey(publicKey: Uint8Array): {
  address: string;
  hex20: string;
} {
  const uncompressed = secp256k1.Point.fromBytes(publicKey).toBytes(false);
  const body = keccak_256(uncompressed.subarray(1)).subarray(-20);
  return {
    address: base58check.encode(Uint8Array.of(TRON_PREFIX, ...body)),
    hex20: hex.encode(body),
  };
}

/** "T..." → lowercase 20-byte hex (no 0x, no 41 prefix), the form TronGrid events use. */
export function tronAddressToHex20(address: string): string {
  const bytes = base58check.decode(address);
  if (bytes.length !== 21 || bytes[0] !== TRON_PREFIX) throw new Error('Not a TRON address');
  return hex.encode(bytes.subarray(1));
}
