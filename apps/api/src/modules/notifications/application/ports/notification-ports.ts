import type { DeliveryAttempt, WebhookDelivery } from '../../domain/webhook-delivery';
import type { WebhookEndpoint } from '../../domain/webhook-endpoint';

export abstract class WebhookEndpointRepository {
  abstract save(endpoint: WebhookEndpoint): Promise<void>;
  abstract findById(id: string): Promise<WebhookEndpoint | null>;
  /** Scoped by organization: another organization's endpoint is `null`. */
  abstract findForOrganization(organizationId: string, id: string): Promise<WebhookEndpoint | null>;
  /** Newest first, enabled and disabled. */
  abstract listForOrganization(organizationId: string): Promise<WebhookEndpoint[]>;
  abstract listEnabledForOrganization(organizationId: string): Promise<WebhookEndpoint[]>;
}

export interface DeliveryPosition {
  createdAt: Date;
  id: string;
}

export abstract class WebhookDeliveryRepository {
  /**
   * Inserts unless a delivery for the same (endpoint, event) exists; returns the stored one.
   * A re-relayed event therefore never creates a second delivery.
   */
  abstract insertIfAbsent(delivery: WebhookDelivery): Promise<WebhookDelivery>;
  /** Updates status and appends the attempts recorded since load. */
  abstract save(delivery: WebhookDelivery): Promise<void>;
  abstract findById(id: string): Promise<WebhookDelivery | null>;
  abstract findForOrganization(
    organizationId: string,
    id: string,
  ): Promise<{ delivery: WebhookDelivery; attempts: DeliveryAttempt[] } | null>;
  abstract listForOrganization(
    organizationId: string,
    page: { limit: number; after: DeliveryPosition | null },
  ): Promise<{ items: WebhookDelivery[]; next: DeliveryPosition | null }>;
  /** Pending deliveries never tried and older than `before`: their enqueue was lost. */
  abstract findNeverAttempted(before: Date, limit: number): Promise<WebhookDelivery[]>;
}

/** Signing secrets: generated, then stored only encrypted (they are needed in clear to sign). */
export abstract class WebhookSecrets {
  abstract generate(): string;
  abstract encrypt(secret: string): string;
  abstract decrypt(ciphertext: string): string;
}

/** `PO-Signature` header value for `body` at `timestamp` (Unix seconds). */
export abstract class WebhookSigner {
  abstract sign(secret: string, body: string, timestamp: number): string;
}

export interface SendResult {
  statusCode: number | null;
  error: string | null;
  durationMs: number;
}

/** One HTTP POST to the merchant, with a timeout and without following redirects. */
export abstract class WebhookSender {
  abstract send(request: {
    url: string;
    body: string;
    headers: Record<string, string>;
  }): Promise<SendResult>;
}

/** Environment-dependent rules, provided from configuration. */
export abstract class NotificationSettings {
  /** Only outside production: lets endpoints point at http://localhost. */
  abstract readonly allowLocalHttp: boolean;
}
