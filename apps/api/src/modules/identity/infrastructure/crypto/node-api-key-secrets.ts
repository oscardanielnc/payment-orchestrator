import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { ApiKeySecrets } from '../../application/ports/api-key-secrets';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * SHA-256 is enough here: the secret has 256 bits of entropy, so brute force is hopeless
 * even with a fast hash. Slow hashes (argon2) exist for low-entropy human passwords (ADR 0011).
 */
@Injectable()
export class NodeApiKeySecrets extends ApiKeySecrets {
  generateKeyId(): string {
    return Array.from({ length: 12 }, () => BASE62[randomInt(BASE62.length)]).join('');
  }

  generateSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  matches(secret: string, secretHash: string): boolean {
    const actual = Buffer.from(this.hash(secret), 'hex');
    const expected = Buffer.from(secretHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
