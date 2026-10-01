import type { PaymentAttempt } from '../../domain/payment-attempt';

export abstract class PaymentAttemptRepository {
  /** Inserts or updates with optimistic locking (ConcurrencyConflictError on a stale version). */
  abstract save(attempt: PaymentAttempt): Promise<void>;
  /** Oldest first. */
  abstract listForCharge(organizationId: string, chargeId: string): Promise<PaymentAttempt[]>;
}
