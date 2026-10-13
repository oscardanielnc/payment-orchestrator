import { DomainError } from '../../../shared/domain/domain-error';

export class FindingNotFoundError extends DomainError {
  readonly code = 'reconciliation_finding.not_found';

  constructor() {
    super('Reconciliation finding not found');
  }
}

export class InvalidFindingCursorError extends DomainError {
  readonly code = 'reconciliation_finding.invalid_cursor';

  constructor() {
    super('Invalid cursor');
  }
}

export class FindingNotOpenError extends DomainError {
  readonly code = 'reconciliation_finding.not_open';

  constructor() {
    super('Only open findings can be resolved');
  }
}

export class UnknownReconciliationSourceError extends DomainError {
  readonly code = 'reconciliation.unknown_source';

  constructor(source: string) {
    super(`No reconciliation source "${source}" is enabled`);
  }
}
