import type { ApiKey } from '../../domain/api-key';

export abstract class ApiKeyRepository {
  /** Inserts or updates. */
  abstract save(apiKey: ApiKey): Promise<void>;
  abstract findById(id: string): Promise<ApiKey | null>;
  /** Newest first. */
  abstract listByOrganization(organizationId: string): Promise<ApiKey[]>;
}
