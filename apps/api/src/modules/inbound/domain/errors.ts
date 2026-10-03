import { DomainError } from '../../../shared/domain/domain-error';

export class UnknownWebhookProviderError extends DomainError {
  readonly code = 'webhook.unknown_provider';

  constructor(provider: string) {
    super(`No webhook endpoint for provider "${provider}"`);
  }
}

/** Signature missing, wrong, or too old. Nothing is stored. */
export class InvalidWebhookSignatureError extends DomainError {
  readonly code = 'webhook.invalid_signature';

  constructor(reason: string) {
    super(`Invalid webhook signature: ${reason}`);
  }
}
