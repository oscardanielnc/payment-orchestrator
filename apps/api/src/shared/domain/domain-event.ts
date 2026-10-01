/**
 * Something that happened in the domain. Written to the outbox in the same
 * transaction as the change that produced it (ADR 0008).
 */
export interface DomainEvent {
  /** Dotted name clients will see, e.g. `charge.succeeded`. */
  type: string;
  aggregateType: string;
  aggregateId: string;
  organizationId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}
