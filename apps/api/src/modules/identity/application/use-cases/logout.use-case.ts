import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { RefreshTokenValue } from '../../domain/refresh-token';
import { OpaqueTokenSecrets, SessionRepository } from '../ports/auth-ports';

/** Ends the session of the presented refresh token. Always succeeds: logging out twice is fine. */
@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly secrets: OpaqueTokenSecrets,
    private readonly clock: Clock,
  ) {}

  async execute(rawToken: string | undefined): Promise<void> {
    const value = rawToken ? RefreshTokenValue.parse(rawToken) : null;
    if (!value) return;
    const record = await this.sessions.findRefreshToken(value.id);
    if (!record || !this.secrets.matches(value.secret, record.secretHash)) return;
    await this.sessions.revokeSession(record.sessionId, 'logout', this.clock.now());
  }
}
