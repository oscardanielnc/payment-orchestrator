import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { ApiKeyToken } from '../../domain/api-key-token';
import { InvalidApiKeyError } from '../../domain/errors';
import { ApiKeyEnvironment } from '../ports/api-key-environment';
import { ApiKeyRepository } from '../ports/api-key.repository';
import { ApiKeySecrets } from '../ports/api-key-secrets';

export interface ApiKeyPrincipal {
  organizationId: string;
  apiKeyId: string;
}

@Injectable()
export class AuthenticateApiKeyUseCase {
  constructor(
    private readonly apiKeys: ApiKeyRepository,
    private readonly secrets: ApiKeySecrets,
    private readonly environment: ApiKeyEnvironment,
    private readonly clock: Clock,
  ) {}

  async execute(rawToken: string): Promise<ApiKeyPrincipal> {
    const token = ApiKeyToken.parse(rawToken);
    if (!token || token.environment !== this.environment.tag) throw new InvalidApiKeyError();

    const apiKey = await this.apiKeys.findById(token.keyId);
    if (!apiKey || !apiKey.isActive || !this.secrets.matches(token.secret, apiKey.secretHash)) {
      throw new InvalidApiKeyError();
    }

    apiKey.recordUse(this.clock.now());
    await this.apiKeys.save(apiKey);
    return { organizationId: apiKey.organizationId, apiKeyId: apiKey.id };
  }
}
