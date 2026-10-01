/**
 * Base for business rule violations. `code` is stable and reaches API clients;
 * the HTTP status is decided in one place (ProblemDetailsFilter), not here.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
