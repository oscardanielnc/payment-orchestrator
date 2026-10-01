import type { DomainEvent } from '../../domain/domain-event';

/**
 * Stores events for later publication. Must be called inside the same unit of work
 * as the change, so the event exists if and only if the change committed.
 */
export abstract class Outbox {
  abstract add(events: DomainEvent[]): Promise<void>;
}
