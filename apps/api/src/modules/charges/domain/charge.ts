import type { DomainEvent } from '../../../shared/domain/domain-event';
import type { Money } from '../../../shared/domain/money';
import { ALLOWED_TRANSITIONS, type ChargeStatus } from './charge-status';
import {
  ChargeNotPayableError,
  InvalidChargeAmountError,
  InvalidChargeTransitionError,
} from './errors';

export interface ChargeProps {
  id: string;
  organizationId: string;
  amount: Money;
  status: ChargeStatus;
  description: string | null;
  reference: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  /** Optimistic locking: 0 = never saved. The repository bumps it on every save. */
  version: number;
}

/**
 * "This customer owes this merchant this amount in this currency."
 * The only place where a charge's status can change.
 */
export class Charge {
  private events: DomainEvent[] = [];

  private constructor(private props: ChargeProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    amount: Money;
    description?: string;
    reference?: string;
    expiresInSeconds: number;
    now: Date;
  }): Charge {
    if (!input.amount.isPositive()) throw new InvalidChargeAmountError();

    const charge = new Charge({
      id: input.id,
      organizationId: input.organizationId,
      amount: input.amount,
      status: 'pending',
      description: input.description ?? null,
      reference: input.reference ?? null,
      expiresAt: new Date(input.now.getTime() + input.expiresInSeconds * 1000),
      createdAt: input.now,
      updatedAt: input.now,
      version: 0,
    });
    charge.record('charge.created', input.now);
    return charge;
  }

  static restore(props: ChargeProps): Charge {
    return new Charge({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get status(): ChargeStatus {
    return this.props.status;
  }
  get description(): string | null {
    return this.props.description;
  }
  get reference(): string | null {
    return this.props.reference;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
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

  isExpiredAt(now: Date): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  /** A payment attempt started (customer picked a method). */
  startProcessing(now: Date): void {
    this.transitionTo('processing', now);
  }

  /**
   * Another payment attempt may start while the charge is open: pending (first attempt,
   * moves to processing) or processing (customer switched method). Never once expired or final.
   */
  beginPaymentAttempt(now: Date): void {
    const open = this.status === 'pending' || this.status === 'processing';
    if (!open || this.isExpiredAt(now)) throw new ChargeNotPayableError(this.status);
    if (this.status === 'pending') this.startProcessing(now);
  }

  markSucceeded(now: Date): void {
    this.transitionTo('succeeded', now);
  }

  markFailed(now: Date): void {
    this.transitionTo('failed', now);
  }

  /** Only a pending charge past its expiry can expire. */
  expire(now: Date): void {
    if (!this.isExpiredAt(now)) throw new InvalidChargeTransitionError(this.status, 'expired');
    this.transitionTo('expired', now);
  }

  /** Called by the repository after a successful save. */
  markPersisted(version: number): void {
    this.props.version = version;
  }

  /** Hands the recorded events to the caller (to write to the outbox) and clears them. */
  pullEvents(): DomainEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  private transitionTo(next: ChargeStatus, now: Date): void {
    if (!ALLOWED_TRANSITIONS[this.props.status].includes(next)) {
      throw new InvalidChargeTransitionError(this.props.status, next);
    }
    this.props.status = next;
    this.props.updatedAt = now;
    this.record(`charge.${next}`, now);
  }

  private record(type: string, now: Date): void {
    this.events.push({
      type,
      aggregateType: 'charge',
      aggregateId: this.props.id,
      organizationId: this.props.organizationId,
      occurredAt: now,
      payload: {
        chargeId: this.props.id,
        status: this.props.status,
        amount: this.props.amount.toMinorUnits(),
        currency: this.props.amount.currency,
        reference: this.props.reference,
      },
    });
  }
}
