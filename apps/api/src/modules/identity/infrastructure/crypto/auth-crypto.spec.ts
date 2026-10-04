import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher, NodeOpaqueTokenSecrets } from './auth-crypto';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('hashes with argon2id and the OWASP parameters, salted per hash', async () => {
    const first = await hasher.hash('correct horse battery staple');
    const second = await hasher.hash('correct horse battery staple');

    expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(first).not.toBe(second);
  });

  it('verifies the right password only', async () => {
    const passwordHash = await hasher.hash('correct horse battery staple');

    expect(await hasher.verify(passwordHash, 'correct horse battery staple')).toBe(true);
    expect(await hasher.verify(passwordHash, 'Correct horse battery staple')).toBe(false);
  });
});

describe('NodeOpaqueTokenSecrets', () => {
  it('generates 256-bit secrets and matches them against their hash only', () => {
    const secrets = new NodeOpaqueTokenSecrets();
    const secret = secrets.generateSecret();

    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secrets.matches(secret, secrets.hash(secret))).toBe(true);
    expect(secrets.matches(`${secret.slice(0, -1)}x`, secrets.hash(secret))).toBe(false);
  });
});
