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
  /**
   * Pending attempts of these providers created after `createdAfter` and untouched since
   * `updatedBefore`: candidates for a status check. Least recently updated first.
   */
  abstract findPendingToSync(query: {
    providers: readonly string[];
    createdAfter: Date;
    updatedBefore: Date;
    limit: number;
  }): Promise<PaymentAttempt[]>;
  /** Oldest first. */
  abstract listForCharge(organizationId: string, chargeId: string): Promise<PaymentAttempt[]>;
}
