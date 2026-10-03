import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import type { Money } from '../../../../shared/domain/money';
import { ChargePaymentsService } from '../../../charges/application/services/charge-payments.service';
import { LedgerService } from '../../../ledger/application/services/ledger.service';
import { ProviderAmountMismatchError } from '../../domain/errors';
import { PaymentAttemptRepository } from '../ports/payment-attempt.repository';
import { providerPaymentCaptured } from '../services/payment-postings';

export type ProviderOutcome =
  | { kind: 'succeeded'; amount: Money }
  /** One try failed; the customer may retry on the same provider payment. Not terminal. */
  | { kind: 'declined'; reason: string }
  /** The provider payment is closed for good. */
  | { kind: 'canceled' };

export type SettleOutcome = 'unknown' | 'already-settled' | 'paid' | 'late' | 'declined' | 'failed';

/**
 * Applies what a card/local provider reported about one of our payments (Stripe today,
 * Mercado Pago later), in ONE transaction. Idempotent: webhooks arrive at least once.
 */
@Injectable()
export class SettleProviderPaymentUseCase {
  private readonly logger = new Logger(SettleProviderPaymentUseCase.name);

  constructor(
    private readonly attempts: PaymentAttemptRepository,
    private readonly charges: ChargePaymentsService,
    private readonly ledger: LedgerService,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  execute(input: {
    provider: string;
    externalReference: string;
    outcome: ProviderOutcome;
  }): Promise<SettleOutcome> {
    return this.transaction.run(async () => {
      const attempt = await this.attempts.findByExternalReference(
        input.provider,
        input.externalReference,
      );
      // Not created by us (e.g. a payment made from the provider's dashboard): nothing to do.
      if (!attempt) return 'unknown';
      if (attempt.status !== 'pending') return 'already-settled';
      const now = this.clock.now();
      const { outcome } = input;

      if (outcome.kind === 'declined') {
        attempt.recordDecline(outcome.reason, now);
        await this.attempts.save(attempt);
        return 'declined';
      }

      if (outcome.kind === 'canceled') {
        attempt.markFailed(now);
        await this.attempts.save(attempt);
        const siblings = await this.attempts.listForCharge(
          attempt.organizationId,
          attempt.chargeId,
        );
        if (!siblings.some((a) => a.status === 'pending')) {
          await this.charges.markFailed(attempt.organizationId, attempt.chargeId);
        }
        return 'failed';
      }

      const charge = await this.charges.snapshot(attempt.organizationId, attempt.chargeId);
      if (!charge.amount.equals(outcome.amount)) {
        // Thrown on purpose: retries, then the dead-letter queue for a person to look at.
        throw new ProviderAmountMismatchError(
          `${charge.amount.toMinorUnits()} ${charge.amount.currency}`,
          `${outcome.amount.toMinorUnits()} ${outcome.amount.currency}`,
        );
      }

      const paid = await this.charges.markPaid(attempt.organizationId, attempt.chargeId);
      if (paid) {
        attempt.markSucceeded(now);
        await this.attempts.save(attempt);
      } else {
        this.logger.warn(
          `Captured payment for closed charge ${attempt.chargeId}; left for reconciliation`,
        );
      }
      await this.ledger.post(
        providerPaymentCaptured({
          provider: input.provider,
          externalReference: input.externalReference,
          organizationId: attempt.organizationId,
          chargeId: attempt.chargeId,
          amount: outcome.amount,
          chargePaid: paid,
        }),
      );
      return paid ? 'paid' : 'late';
    });
  }
}
