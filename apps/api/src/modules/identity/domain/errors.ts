import { DomainError } from '../../../shared/domain/domain-error';

export class InvalidOrganizationNameError extends DomainError {
  readonly code = 'organization.invalid_name';

  constructor() {
    super('Organization name must be between 2 and 100 characters');
  }
}

export class OrganizationNotFoundError extends DomainError {
  readonly code = 'organization.not_found';

  constructor() {
    super('Organization not found');
  }
}

export class InvalidApiKeyNameError extends DomainError {
  readonly code = 'api_key.invalid_name';

  constructor() {
    super('API key name must be between 1 and 60 characters');
  }
}

export class ApiKeyNotFoundError extends DomainError {
  readonly code = 'api_key.not_found';

  constructor() {
    super('API key not found');
  }
}

/**
 * Same error for malformed, unknown, revoked or wrong-secret keys, so a caller
 * cannot learn which keys exist.
 */
export class InvalidApiKeyError extends DomainError {
  readonly code = 'api_key.invalid';

  constructor() {
    super('Missing or invalid API key');
  }
}

/** Same error for unknown email and wrong password: nobody can probe which emails exist. */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'auth.invalid_credentials';

  constructor() {
    super('Invalid email or password');
  }
}

/** Unknown, expired, revoked or reused refresh token. The client must log in again. */
export class InvalidSessionError extends DomainError {
  readonly code = 'auth.invalid_session';

  constructor() {
    super('The session is no longer valid; log in again');
  }
}

export class UnauthenticatedError extends DomainError {
  readonly code = 'auth.unauthenticated';

  constructor() {
    super('Missing or invalid credentials');
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'auth.forbidden';

  constructor(reason: string) {
    super(reason);
  }
}

export class EmailTakenError extends DomainError {
  readonly code = 'user.email_taken';

  constructor() {
    super('A user with this email already exists');
  }
}

export class InvalidEmailError extends DomainError {
  readonly code = 'user.invalid_email';

  constructor() {
    super('The email address is not valid');
  }
}

export class WeakPasswordError extends DomainError {
  readonly code = 'user.weak_password';

  constructor() {
    super('Passwords need 12 to 128 characters');
  }
}
