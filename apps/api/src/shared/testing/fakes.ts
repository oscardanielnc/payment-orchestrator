import { Clock } from '../application/ports/clock';
import { IdGenerator } from '../application/ports/id-generator';
import { Outbox, type StoredDomainEvent } from '../application/ports/outbox';
import { TransactionRunner } from '../application/ports/transaction-runner';
import type { DomainEvent } from '../domain/domain-event';

// In-memory doubles of the shared ports, for use case tests in any module.

export class FixedClock extends Clock {
  constructor(public current = new Date('2026-10-01T12:00:00Z')) {
    super();
  }

  now(): Date {
    return this.current;
  }
}

export class SequentialIdGenerator extends IdGenerator {
  private counter = 0;

  uuid(): string {
    this.counter += 1;
    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }

  secureToken(): string {
    this.counter += 1;
    return `token${String(this.counter).padStart(17, '0')}`;
  }
}

export class ImmediateTransactionRunner extends TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

export class InMemoryOutbox extends Outbox {
  readonly events: DomainEvent[] = [];

  add(events: DomainEvent[]): Promise<void> {
    this.events.push(...events);
    return Promise.resolve();
  }

  claimUnpublished(): Promise<StoredDomainEvent[]> {
    return Promise.resolve([]);
  }

  markPublished(): Promise<void> {
    return Promise.resolve();
  }

  listForAggregate(): Promise<StoredDomainEvent[]> {
    return Promise.resolve([]);
  }
}
