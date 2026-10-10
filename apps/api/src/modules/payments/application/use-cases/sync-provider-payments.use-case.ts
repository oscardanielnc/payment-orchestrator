import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { PaymentAttemptRepository } from '../ports/payment-attempt.repository';
import { PaymentProviderRegistry } from '../ports/payment-provider-registry';
import { SettleProviderPaymentUseCase } from './settle-provider-payment.use-case';

/** Webhooks normally land in seconds; older silence is worth a question to the provider. */
export const SYNC_AFTER_MS = 2 * 60_000;
/** Past this, a missed payment is left to reconciliation (bounds API calls per open attempt). */
export const SYNC_WINDOW_MS = 60 * 60_000;
const BATCH = 50;

/**
 * Safety net for lost webhooks (ADR 0019): asks providers about pending attempts nobody
 * has heard from and settles them exactly as the webhook would have. Each attempt is
 * independent: one provider error does not stop the batch.
 */
@Injectable()
export class SyncProviderPaymentsUseCase {
  private readonly logger = new Logger(SyncProviderPaymentsUseCase.name);

  constructor(
    private readonly attempts: PaymentAttemptRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly settle: SettleProviderPaymentUseCase,
    private readonly clock: Clock,
  ) {}

  /** Returns how many attempts changed state. */
  async execute(): Promise<number> {
    const checkable = this.providers.all().filter((p) => p.fetchOutcome !== undefined);
    if (checkable.length === 0) return 0;

    const now = this.clock.now().getTime();
    const stale = await this.attempts.findPendingToSync({
      providers: checkable.map((p) => p.id),
      createdAfter: new Date(now - SYNC_WINDOW_MS),
      updatedBefore: new Date(now - SYNC_AFTER_MS),
      limit: BATCH,
    });

    let settled = 0;
    for (const attempt of stale) {
      try {
        const outcome = await this.providers
          .find(attempt.provider)
          ?.fetchOutcome?.(attempt.externalReference);
        if (!outcome) continue;
        const result = await this.settle.execute({
          provider: attempt.provider,
          externalReference: attempt.externalReference,
          outcome,
        });
        if (result !== 'already-settled' && result !== 'unknown') {
          settled += 1;
          this.logger.warn(`Settled ${attempt.externalReference} by status check: ${result}`);
        }
      } catch (error) {
        this.logger.error(`Status check failed for ${attempt.externalReference}`, error as Error);
      }
    }
    return settled;
  }
}
