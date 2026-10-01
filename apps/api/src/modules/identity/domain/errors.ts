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
