import { describe, expect, it } from 'vitest';
import { ApiKey } from './api-key';
import { InvalidApiKeyNameError } from './errors';

const issue = (name = 'Server') =>
  ApiKey.issue({
    id: 'AbC123xyZ789',
    organizationId: 'org-1',
    name,
    secretHash: 'hash',
    now: new Date('2026-10-01T00:00:00Z'),
  });

describe('ApiKey', () => {
  it('starts active and unused', () => {
    const key = issue();

    expect(key.isActive).toBe(true);
    expect(key.lastUsedAt).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(() => issue('   ')).toThrow(InvalidApiKeyNameError);
  });

  it('keeps the first revocation time when revoked twice', () => {
    const key = issue();
    const first = new Date('2026-10-02T00:00:00Z');

    key.revoke(first);
    key.revoke(new Date('2026-10-03T00:00:00Z'));

    expect(key.isActive).toBe(false);
    expect(key.revokedAt).toEqual(first);
  });
});
