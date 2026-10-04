import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticateAccessTokenUseCase } from '../../application/use-cases/authenticate-access-token.use-case';
import { AuthenticateApiKeyUseCase } from '../../application/use-cases/authenticate-api-key.use-case';
import type { Principal } from '../../application/principal';
import { UnauthenticatedError } from '../../domain/errors';

export interface AuthenticatedRequest extends Request {
  principal?: Principal;
}

/**
 * `Authorization: Bearer <credential>` where the credential is either
 *   - an API key (`po_<env>_…`): merchant servers, or
 *   - a dashboard access token (JWT): a signed-in user.
 * Both end as a Principal scoped to one organization.
 */
@Injectable()
export class MerchantAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeys: AuthenticateApiKeyUseCase,
    private readonly accessTokens: AuthenticateAccessTokenUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, credential] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !credential) throw new UnauthenticatedError();

    if (credential.startsWith('po_')) {
      const { organizationId, apiKeyId } = await this.apiKeys.execute(credential);
      request.principal = { organizationId, actor: { type: 'api_key', apiKeyId } };
    } else {
      request.principal = await this.accessTokens.execute(credential);
    }
    return true;
  }
}
