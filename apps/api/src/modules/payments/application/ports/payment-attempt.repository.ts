import type { PaymentAttempt } from '../../domain/payment-attempt';

export abstract class PaymentAttemptRepository {
  /** Inserts or updates with optimistic locking (ConcurrencyConflictError on a stale version). */
  abstract save(attempt: PaymentAttempt): Promise<void>;
  abstract findById(id: string): Promise<PaymentAttempt | null>;
  /** How provider webhooks find the attempt (e.g. a PaymentIntent id). */
  abstract findByExternalReference(
    provider: string,
    externalReference: string,
  ): Promise<PaymentAttempt | null>;
  /** Oldest first. */
  abstract listForCharge(organizationId: string, chargeId: string): Promise<PaymentAttempt[]>;
}
