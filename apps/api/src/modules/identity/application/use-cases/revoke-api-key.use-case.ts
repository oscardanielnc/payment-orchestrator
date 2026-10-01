import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { ApiKeyNotFoundError } from '../../domain/errors';
import { ApiKeyRepository } from '../ports/api-key.repository';

@Injectable()
export class RevokeApiKeyUseCase {
  constructor(
    private readonly apiKeys: ApiKeyRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { organizationId: string; apiKeyId: string }): Promise<void> {
    const apiKey = await this.apiKeys.findById(input.apiKeyId);
    // Another organization's key looks exactly like a missing one.
    if (!apiKey || apiKey.organizationId !== input.organizationId) {
      throw new ApiKeyNotFoundError();
    }
    apiKey.revoke(this.clock.now());
    await this.apiKeys.save(apiKey);
  }
}
