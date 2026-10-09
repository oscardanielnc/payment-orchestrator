export type DeliveryStatus = 'pending' | 'succeeded' | 'failed';

export interface DeliveryAttempt {
  attemptedAt: Date;
  /** `null` when no HTTP response came back (timeout, DNS, refused connection). */
  statusCode: number | null;
  error: string | null;
  durationMs: number;
}

export interface WebhookDeliveryProps {
  id: string;
  organizationId: string;
  endpointId: string;
  /** The outbox event id: stable across retries, so merchants can deduplicate. */
  eventId: string;
  eventType: string;
  /** Exact JSON sent on every attempt (only the signature's timestamp changes). */
  payload: string;
  status: DeliveryStatus;
  attemptCount: number;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt: Date | null;
}

/** Events merchants receive (feature 14). Other domain events stay internal. */
export const SUBSCRIBABLE_EVENTS = ['charge.succeeded', 'charge.failed', 'charge.expired'];

/**
 * One event on its way to one endpoint. At-least-once: it is retried until a 2xx or until
 * the attempts run out; every try is recorded for the dashboard.
 */
export class WebhookDelivery {
  private newAttempts: DeliveryAttempt[] = [];

  private constructor(private props: WebhookDeliveryProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    endpointId: string;
    eventId: string;
    eventType: string;
    payload: string;
    now: Date;
  }): WebhookDelivery {
    return new WebhookDelivery({
      ...input,
      status: 'pending',
      attemptCount: 0,
      lastStatusCode: null,
      lastError: null,
      createdAt: input.now,
      updatedAt: input.now,
      deliveredAt: null,
    });
  }

  static restore(props: WebhookDeliveryProps): WebhookDelivery {
    return new WebhookDelivery({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get endpointId(): string {
    return this.props.endpointId;
  }
  get eventId(): string {
    return this.props.eventId;
  }
  get eventType(): string {
    return this.props.eventType;
  }
  get payload(): string {
    return this.props.payload;
  }
  get status(): DeliveryStatus {
    return this.props.status;
  }
  get attemptCount(): number {
    return this.props.attemptCount;
  }
  get lastStatusCode(): number | null {
    return this.props.lastStatusCode;
  }
  get lastError(): string | null {
    return this.props.lastError;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deliveredAt(): Date | null {
    return this.props.deliveredAt;
  }
  get isPending(): boolean {
    return this.props.status === 'pending';
  }

  /**
   * Records one try. A 2xx delivers it; anything else leaves it pending for a retry, or
   * fails it when this was the last allowed attempt.
   */
  recordAttempt(attempt: DeliveryAttempt, isLastAllowed: boolean): void {
    if (!this.isPending) return;
    const ok = attempt.statusCode !== null && attempt.statusCode >= 200 && attempt.statusCode < 300;

    this.newAttempts.push(attempt);
    this.props.attemptCount += 1;
    this.props.lastStatusCode = attempt.statusCode;
    this.props.lastError = ok ? null : attempt.error;
    this.props.updatedAt = attempt.attemptedAt;
    if (ok) {
      this.props.status = 'succeeded';
      this.props.deliveredAt = attempt.attemptedAt;
    } else if (isLastAllowed) {
      this.props.status = 'failed';
    }
  }

  /** The endpoint was disabled while this was pending: stop without another request. */
  abandon(reason: string, now: Date): void {
    if (!this.isPending) return;
    this.props.status = 'failed';
    this.props.lastError = reason;
    this.props.updatedAt = now;
  }

  /** Attempts recorded since load, for the repository to append. */
  pullNewAttempts(): DeliveryAttempt[] {
    const attempts = this.newAttempts;
    this.newAttempts = [];
    return attempts;
  }
}
