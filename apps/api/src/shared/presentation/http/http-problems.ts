import { HttpStatus } from '@nestjs/common';

/**
 * Errors that only make sense at the HTTP edge (bad headers, invalid bodies).
 * Business rule violations are `DomainError`s instead.
 */
export abstract class HttpProblem extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  readonly extensions: Record<string, unknown> = {};
}

export interface FieldError {
  field: string;
  message: string;
}

export class RequestValidationError extends HttpProblem {
  readonly status = HttpStatus.BAD_REQUEST;
  readonly code = 'validation_failed';

  constructor(readonly errors: FieldError[]) {
    super('The request is invalid');
    this.extensions.errors = errors;
  }
}

export class IdempotencyKeyRequiredError extends HttpProblem {
  readonly status = HttpStatus.BAD_REQUEST;
  readonly code = 'idempotency.key_required';

  constructor() {
    super('This endpoint requires an Idempotency-Key header (1 to 255 characters)');
  }
}

export class IdempotencyKeyReusedError extends HttpProblem {
  readonly status = HttpStatus.CONFLICT;
  readonly code = 'idempotency.key_reused';

  constructor() {
    super('This Idempotency-Key was already used with a different request');
  }
}
