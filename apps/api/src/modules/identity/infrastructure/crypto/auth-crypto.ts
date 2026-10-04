import { hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { OpaqueTokenSecrets, PasswordHasher } from '../../application/ports/auth-ports';

/**
 * argon2id with the library defaults, which match OWASP's recommendation
 * (19 MiB memory, 2 iterations, 1 lane). Memory-hard: GPUs gain little guessing passwords.
 */
@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    // The library defaults to argon2id (asserted in auth-crypto.spec.ts).
    return hash(password);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}

/** 256-bit random secrets; SHA-256 is enough for them (no human-chosen entropy to protect). */
@Injectable()
export class NodeOpaqueTokenSecrets extends OpaqueTokenSecrets {
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
