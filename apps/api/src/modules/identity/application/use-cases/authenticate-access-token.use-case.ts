import { Injectable } from '@nestjs/common';
import { UnauthenticatedError } from '../../domain/errors';
import { AccessTokens } from '../ports/auth-ports';
import type { Principal } from '../principal';

/**
 * Stateless check of a dashboard access token (signature + expiry). Revocation is handled by
 * keeping access tokens short (15 min) and refusing to refresh a revoked session.
 */
@Injectable()
export class AuthenticateAccessTokenUseCase {
  constructor(private readonly accessTokens: AccessTokens) {}

  async execute(token: string): Promise<Principal> {
    try {
      const claims = await this.accessTokens.verify(token);
      return {
        organizationId: claims.organizationId,
        actor: { type: 'user', userId: claims.userId, role: claims.role },
      };
    } catch {
      throw new UnauthenticatedError();
    }
  }
}
