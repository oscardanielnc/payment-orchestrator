import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { ApiKey } from '../../domain/api-key';
import { ApiKeyToken } from '../../domain/api-key-token';
import { ApiKeyEnvironment } from '../ports/api-key-environment';
import { ApiKeySecrets } from '../ports/api-key-secrets';

export interface IssuedApiKey {
  apiKey: ApiKey;
  /** Full token. Returned once to the caller and never stored. */
  token: string;
}

/** Shared by the use cases that create keys. Builds the entity; does not persist it. */
@Injectable()
export class ApiKeyIssuer {
  constructor(
    private readonly secrets: ApiKeySecrets,
    private readonly environment: ApiKeyEnvironment,
    private readonly clock: Clock,
  ) {}

  issue(organizationId: string, name: string): IssuedApiKey {
    const keyId = this.secrets.generateKeyId();
    const secret = this.secrets.generateSecret();
    const apiKey = ApiKey.issue({
      id: keyId,
      organizationId,
      name,
      secretHash: this.secrets.hash(secret),
      now: this.clock.now(),
    });
    const token = ApiKeyToken.of(this.environment.tag, keyId, secret);
    return { apiKey, token: token.toString() };
  }
}
