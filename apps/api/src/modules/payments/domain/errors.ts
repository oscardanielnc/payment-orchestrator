import { DomainError } from '../../../shared/domain/domain-error';

export class UnsupportedPaymentMethodError extends DomainError {
  readonly code = 'payment_method.unsupported';

  constructor(method: string, currency: string) {
    super(`No provider supports ${method} payments in ${currency}`);
  }
}

/** The route exists but its provider is not configured in this environment. */
export class PaymentMethodUnavailableError extends DomainError {
  readonly code = 'payment_method.unavailable';

  constructor(method: string) {
    super(`The ${method} payment method is not available right now`);
  }
}

export class InvalidAttemptTransitionError extends DomainError {
  readonly code = 'payment_attempt.invalid_transition';

  constructor(from: string, to: string) {
    super(`A ${from} payment attempt cannot become ${to}`);
  }
}
