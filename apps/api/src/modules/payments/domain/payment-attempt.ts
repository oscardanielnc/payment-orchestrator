import { InvalidAttemptTransitionError } from './errors';
import type { PaymentInstructions } from './payment-instructions';
import type { PaymentMethod, ProviderId } from './payment-route';

export type AttemptStatus = 'pending' | 'succeeded' | 'failed';

export interface PaymentAttemptProps {
  id: string;
  chargeId: string;
  organizationId: string;
  method: PaymentMethod;
  provider: ProviderId;
  status: AttemptStatus;
  /** The provider's id for this payment (PaymentIntent id, deposit address...). */
  externalReference: string;
  instructions: PaymentInstructions;
  /** Last decline reported by the provider while the attempt stays open (e.g. card declined). */
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * One try at paying a charge with one method. A charge may have several (the customer
 * switches method); at most one succeeds, guarded here and by a partial unique index.
 */
export class PaymentAttempt {
  private constructor(private props: PaymentAttemptProps) {}

  static start(
    input: Omit<
      PaymentAttemptProps,
      'status' | 'failureReason' | 'createdAt' | 'updatedAt' | 'version'
    > & {
      now: Date;
    },
  ): PaymentAttempt {
    const { now, ...rest } = input;
    return new PaymentAttempt({
      ...rest,
      status: 'pending',
      failureReason: null,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  static restore(props: PaymentAttemptProps): PaymentAttempt {
    return new PaymentAttempt({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get chargeId(): string {
    return this.props.chargeId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get method(): PaymentMethod {
    return this.props.method;
  }
  get provider(): ProviderId {
    return this.props.provider;
  }
  get status(): AttemptStatus {
    return this.props.status;
  }
  get externalReference(): string {
    return this.props.externalReference;
  }
  get instructions(): PaymentInstructions {
    return this.props.instructions;
  }
  get failureReason(): string | null {
    return this.props.failureReason;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get version(): number {
    return this.props.version;
  }

  /**
   * The provider declined one try but the attempt can still succeed (Stripe lets the customer
   * retry on the same PaymentIntent). Recorded, not terminal.
   */
  recordDecline(reason: string, now: Date): void {
    if (this.props.status !== 'pending')
      throw new InvalidAttemptTransitionError(this.props.status, 'declined');
    this.props.failureReason = reason;
    this.props.updatedAt = now;
  }

  markSucceeded(now: Date): void {
    this.settle('succeeded', now);
  }

  markFailed(now: Date): void {
    this.settle('failed', now);
  }

  markPersisted(version: number): void {
    this.props.version = version;
  }

  private settle(next: AttemptStatus, now: Date): void {
    if (this.props.status !== 'pending') {
      throw new InvalidAttemptTransitionError(this.props.status, next);
    }
    this.props.status = next;
    this.props.updatedAt = now;
  }
}
