import { describe, expect, it } from 'vitest';
import { ApiKeyToken } from './api-key-token';

const SECRET = 'a'.repeat(40) + '_-b';

describe('ApiKeyToken', () => {
  it('round-trips through its wire format', () => {
    const token = ApiKeyToken.of('test', 'AbC123xyZ789', SECRET);

    const parsed = ApiKeyToken.parse(token.toString());

    expect(parsed).toEqual(token);
    expect(token.toString()).toBe(`po_test_AbC123xyZ789_${SECRET}`);
  });

  it('keeps underscores inside the secret', () => {
    expect(ApiKeyToken.parse(`po_test_AbC123xyZ789_${SECRET}`)?.secret).toBe(SECRET);
  });

  it.each([
    ['empty', ''],
    ['wrong prefix', `pk_test_AbC123xyZ789_${SECRET}`],
    ['short key id', `po_test_AbC123_${SECRET}`],
    ['short secret', 'po_test_AbC123xyZ789_tooshort'], // gitleaks:allow (malformed fixture)
    ['no environment', `po__AbC123xyZ789_${SECRET}`],
  ])('rejects %s', (_label, raw) => {
    expect(ApiKeyToken.parse(raw)).toBeNull();
  });

  it('builds a display prefix without the secret', () => {
    expect(ApiKeyToken.displayPrefix('test', 'AbC123xyZ789')).toBe('po_test_AbC123xyZ789');
  });
});
