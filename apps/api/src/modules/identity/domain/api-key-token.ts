const TOKEN = /^po_([a-z]+)_([A-Za-z0-9]{12})_([A-Za-z0-9_-]{43})$/;

/**
 * Wire format of an API key: `po_<environment>_<keyId>_<secret>`.
 * `keyId` is public and indexes the row; `secret` is never stored.
 * The environment tag lets a key from one environment be rejected in another.
 */
export class ApiKeyToken {
  private constructor(
    readonly environment: string,
    readonly keyId: string,
    readonly secret: string,
  ) {}

  static of(environment: string, keyId: string, secret: string): ApiKeyToken {
    const token = ApiKeyToken.parse(`po_${environment}_${keyId}_${secret}`);
    if (!token) throw new Error('Malformed API key parts');
    return token;
  }

  static parse(raw: string): ApiKeyToken | null {
    const match = TOKEN.exec(raw);
    if (!match) return null;
    const [, environment, keyId, secret] = match;
    if (!environment || !keyId || !secret) return null;
    return new ApiKeyToken(environment, keyId, secret);
  }

  /** Safe to show and log: identifies the key without the secret. */
  static displayPrefix(environment: string, keyId: string): string {
    return `po_${environment}_${keyId}`;
  }

  toString(): string {
    return `${ApiKeyToken.displayPrefix(this.environment, this.keyId)}_${this.secret}`;
  }
}
