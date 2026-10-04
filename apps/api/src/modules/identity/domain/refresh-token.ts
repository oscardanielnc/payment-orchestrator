const TOKEN = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/;

/** Wire format of a refresh token: `<token id>.<secret>`. Only a hash of the secret is stored. */
export class RefreshTokenValue {
  private constructor(
    readonly id: string,
    readonly secret: string,
  ) {}

  static of(id: string, secret: string): RefreshTokenValue {
    const value = RefreshTokenValue.parse(`${id}.${secret}`);
    if (!value) throw new Error('Malformed refresh token parts');
    return value;
  }

  static parse(raw: string): RefreshTokenValue | null {
    const match = TOKEN.exec(raw);
    return match?.[1] && match[2] ? new RefreshTokenValue(match[1], match[2]) : null;
  }

  toString(): string {
    return `${this.id}.${this.secret}`;
  }
}

export interface RefreshTokenRecord {
  id: string;
  sessionId: string;
  secretHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: Date;
  revokedAt: Date | null;
}
