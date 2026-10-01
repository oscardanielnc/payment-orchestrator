/** Randomness and hashing for API keys, kept out of the domain so it stays pure and testable. */
export abstract class ApiKeySecrets {
  /** 12 base62 characters: the public, indexable part of the token. */
  abstract generateKeyId(): string;
  /** 32 random bytes, base64url (43 characters). */
  abstract generateSecret(): string;
  abstract hash(secret: string): string;
  /** Must compare in constant time. */
  abstract matches(secret: string, secretHash: string): boolean;
}
