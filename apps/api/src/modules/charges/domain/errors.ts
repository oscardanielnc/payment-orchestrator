import { DomainError } from '../../../shared/domain/domain-error';
import type { ChargeStatus } from './charge-status';

export class InvalidChargeAmountError extends DomainError {
  readonly code = 'charge.invalid_amount';

  constructor() {
    super('Charge amount must be greater than zero');
  }
}

export class InvalidChargeTransitionError extends DomainError {
  readonly code = 'charge.invalid_transition';

  constructor(from: ChargeStatus, to: ChargeStatus) {
    super(`A ${from} charge cannot become ${to}`);
  }
}

export class ChargeNotFoundError extends DomainError {
  readonly code = 'charge.not_found';

  constructor() {
    super('Charge not found');
  }
}

export class InvalidChargeCursorError extends DomainError {
  readonly code = 'charge.invalid_cursor';

  constructor() {
    super('The pagination cursor is invalid');
  }
}
