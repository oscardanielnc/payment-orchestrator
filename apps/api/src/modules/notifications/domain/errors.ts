import { DomainError } from '../../../shared/domain/domain-error';

export class InvalidWebhookUrlError extends DomainError {
  readonly code = 'webhook_endpoint.invalid_url';

  constructor(reason: string) {
    super(`Invalid webhook URL: ${reason}`);
  }
}

export class WebhookEndpointNotFoundError extends DomainError {
  readonly code = 'webhook_endpoint.not_found';

  constructor() {
    super('Webhook endpoint not found');
  }
}

export class WebhookDeliveryNotFoundError extends DomainError {
  readonly code = 'webhook_delivery.not_found';

  constructor() {
    super('Webhook delivery not found');
  }
}

export class InvalidWebhookCursorError extends DomainError {
  readonly code = 'webhook_delivery.invalid_cursor';

  constructor() {
    super('The pagination cursor is invalid');
  }
}
