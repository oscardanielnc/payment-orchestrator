import { Injectable } from '@nestjs/common';
import { ApiKeyToken } from '../../domain/api-key-token';
import { ApiKeyEnvironment } from '../ports/api-key-environment';
import { ApiKeyRepository } from '../ports/api-key.repository';

/** What can be shown about a key after creation: never the secret or its hash. */
export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

@Injectable()
export class ListApiKeysUseCase {
  constructor(
    private readonly apiKeys: ApiKeyRepository,
    private readonly environment: ApiKeyEnvironment,
  ) {}

  async execute(organizationId: string): Promise<ApiKeySummary[]> {
    const keys = await this.apiKeys.listByOrganization(organizationId);
    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: ApiKeyToken.displayPrefix(this.environment.tag, key.id),
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
    }));
  }
}
