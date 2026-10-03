import type { DomainEvent } from '../../domain/domain-event';

export interface StoredDomainEvent extends DomainEvent {
  id: string;
}

/**
 * Stores events for later publication (ADR 0008). `add` must run inside the same unit of
 * work as the change, so the event exists if and only if the change committed.
 */
export abstract class Outbox {
  abstract add(events: DomainEvent[]): Promise<void>;
  /**
   * Oldest unpublished events, locked for this transaction only (`FOR UPDATE SKIP LOCKED`):
   * two relays running at once never pick the same event.
   */
  abstract claimUnpublished(limit: number): Promise<StoredDomainEvent[]>;
  abstract markPublished(ids: string[], at: Date): Promise<void>;
}
