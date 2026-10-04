import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from '../../../../config/app-config';
import { type AccessTokenClaims, AccessTokens } from '../../application/ports/auth-ports';
import type { MemberRole } from '../../domain/user';

interface AccessTokenPayload {
  sub: string;
  org: string;
  role: MemberRole;
  typ: 'access';
}

/** HS256 JWTs. The algorithm is pinned on verify, so a forged `alg: none` token is rejected. */
@Injectable()
export class JwtAccessTokens extends AccessTokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {
    super();
  }

  async issue(claims: AccessTokenClaims): Promise<{ token: string; expiresInSeconds: number }> {
    const expiresInSeconds = this.config.auth.accessTokenTtlSeconds;
    const payload: AccessTokenPayload = {
      sub: claims.userId,
      org: claims.organizationId,
      role: claims.role,
      typ: 'access',
    };
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.auth.accessTokenSecret,
      algorithm: 'HS256',
      expiresIn: expiresInSeconds,
    });
    return { token, expiresInSeconds };
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.auth.accessTokenSecret,
      algorithms: ['HS256'],
    });
    if (payload.typ !== 'access' || !payload.sub || !payload.org) {
      throw new Error('Not an access token');
    }
    return { userId: payload.sub, organizationId: payload.org, role: payload.role };
  }
}
