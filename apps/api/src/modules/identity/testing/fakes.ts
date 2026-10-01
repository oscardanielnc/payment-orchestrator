import { ApiKeyEnvironment } from '../application/ports/api-key-environment';
import { ApiKeySecrets } from '../application/ports/api-key-secrets';
import { ApiKeyRepository } from '../application/ports/api-key.repository';
import { OrganizationRepository } from '../application/ports/organization.repository';
import { ApiKey } from '../domain/api-key';
import { Organization } from '../domain/organization';

// In-memory doubles of the ports: use case tests run in milliseconds with no database.

export class InMemoryOrganizationRepository extends OrganizationRepository {
  readonly rows = new Map<string, Organization>();

  save(organization: Organization): Promise<void> {
    this.rows.set(organization.id, organization);
    return Promise.resolve();
  }

  findById(id: string): Promise<Organization | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
}

export class InMemoryApiKeyRepository extends ApiKeyRepository {
  readonly rows = new Map<string, ApiKey>();

  save(apiKey: ApiKey): Promise<void> {
    // Store a copy, like a database would, so tests catch forgotten saves.
    this.rows.set(apiKey.id, ApiKey.restore({ ...snapshot(apiKey) }));
    return Promise.resolve();
  }

  findById(id: string): Promise<ApiKey | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? ApiKey.restore(snapshot(row)) : null);
  }

  listByOrganization(organizationId: string): Promise<ApiKey[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((key) => key.organizationId === organizationId),
    );
  }
}

function snapshot(apiKey: ApiKey) {
  return {
    id: apiKey.id,
    organizationId: apiKey.organizationId,
    name: apiKey.name,
    secretHash: apiKey.secretHash,
    createdAt: apiKey.createdAt,
    revokedAt: apiKey.revokedAt,
    lastUsedAt: apiKey.lastUsedAt,
  };
}

/** Deterministic: ids and secrets are numbered, hash is reversible-looking on purpose. */
export class FakeApiKeySecrets extends ApiKeySecrets {
  private counter = 0;

  generateKeyId(): string {
    this.counter += 1;
    return `key${String(this.counter).padStart(9, '0')}`;
  }

  generateSecret(): string {
    return 's'.repeat(42) + String(this.counter % 10);
  }

  hash(secret: string): string {
    return `hashed:${secret}`;
  }

  matches(secret: string, secretHash: string): boolean {
    return this.hash(secret) === secretHash;
  }
}

export const testEnvironment: ApiKeyEnvironment = { tag: 'test' };
