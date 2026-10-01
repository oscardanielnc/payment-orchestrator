import { InvalidApiKeyNameError } from './errors';

export interface ApiKeyProps {
  id: string;
  organizationId: string;
  name: string;
  secretHash: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

/** Holds only the hash of the secret; the plain secret exists once, at issue time. */
export class ApiKey {
  private constructor(private props: ApiKeyProps) {}

  static issue(input: {
    id: string;
    organizationId: string;
    name: string;
    secretHash: string;
    now: Date;
  }): ApiKey {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 60) throw new InvalidApiKeyNameError();
    return new ApiKey({
      id: input.id,
      organizationId: input.organizationId,
      name,
      secretHash: input.secretHash,
      createdAt: input.now,
      revokedAt: null,
      lastUsedAt: null,
    });
  }

  static restore(props: ApiKeyProps): ApiKey {
    return new ApiKey({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get secretHash(): string {
    return this.props.secretHash;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }
  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }
  get isActive(): boolean {
    return this.props.revokedAt === null;
  }

  /** Idempotent: revoking twice keeps the first revocation time. */
  revoke(now: Date): void {
    if (this.isActive) this.props.revokedAt = now;
  }

  recordUse(now: Date): void {
    this.props.lastUsedAt = now;
  }
}
