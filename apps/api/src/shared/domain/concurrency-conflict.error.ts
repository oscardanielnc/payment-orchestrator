import { DomainError } from './domain-error';

/** Optimistic locking: someone else changed the record since it was read. Safe to retry. */
export class ConcurrencyConflictError extends DomainError {
  readonly code = 'concurrency.conflict';

  constructor(entity: string) {
    super(`${entity} was modified concurrently; retry the request`);
  }
}
