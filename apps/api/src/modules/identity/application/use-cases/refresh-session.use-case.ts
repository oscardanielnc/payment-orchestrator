import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { InvalidSessionError } from '../../domain/errors';
import { RefreshTokenValue } from '../../domain/refresh-token';
import { OpaqueTokenSecrets, SessionRepository, UserRepository } from '../ports/auth-ports';
import type { User } from '../../domain/user';
import { type IssuedTokens, SessionIssuer } from '../services/session-issuer';

/**
 * Refresh token rotation with reuse detection (ADR 0011):
 *   valid, unused token  → mark used, issue a new pair in the same session
 *   token already used   → it leaked (attacker or victim used it first): revoke the whole session
 *   unknown/expired/revoked → log in again
 */
@Injectable()
export class RefreshSessionUseCase {
  private readonly logger = new Logger(RefreshSessionUseCase.name);

  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly secrets: OpaqueTokenSecrets,
    private readonly issuer: SessionIssuer,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(rawToken: string | undefined): Promise<IssuedTokens & { user: User }> {
    const result = await this.transaction.run(async () => {
      const value = rawToken ? RefreshTokenValue.parse(rawToken) : null;
      if (!value) return null;
      const record = await this.sessions.findRefreshToken(value.id);
      if (!record || !this.secrets.matches(value.secret, record.secretHash)) return null;
      const session = await this.sessions.findSession(record.sessionId);
      const now = this.clock.now();
      if (!session || session.revokedAt || record.expiresAt <= now) return null;

      if (!(await this.sessions.markRefreshTokenUsed(record.id, now))) {
        // Committed (not thrown inside the transaction, which would roll the revocation back).
        await this.sessions.revokeSession(session.id, 'refresh_token_reuse', now);
        return 'reuse' as const;
      }

      const user = await this.users.findById(session.userId);
      if (!user) return null;
      return { ...(await this.issuer.issueTokens(user, session.id)), user };
    });

    if (result === 'reuse') {
      this.logger.warn('Refresh token reuse detected; session revoked');
      throw new InvalidSessionError();
    }
    if (!result) throw new InvalidSessionError();
    return result;
  }
}
