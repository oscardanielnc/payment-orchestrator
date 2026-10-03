import type { InboundEvent, VerifiedEvent } from '../../domain/inbound-event';

export abstract class InboundEventRepository {
  /** Inserts unless (provider, externalId) exists. Returns the stored row and whether it is new. */
  abstract insertIfNew(event: InboundEvent): Promise<{ event: InboundEvent; created: boolean }>;
  abstract findById(id: string): Promise<InboundEvent | null>;
  /** Ids of events still `received` since before `receivedBefore`, oldest first. */
  abstract findStaleReceived(receivedBefore: Date): Promise<string[]>;
  abstract markHandled(id: string, status: 'processed' | 'ignored', at: Date): Promise<void>;
  abstract recordFailure(
    id: string,
    error: string,
    attempts: number,
    final: boolean,
  ): Promise<void>;
}

/**
 * Checks a provider's signature over the RAW body (parsing first would change the bytes and
 * break the signature). Throws InvalidWebhookSignatureError when it does not match.
 */
export abstract class WebhookVerifier {
  abstract readonly provider: string;
  abstract verify(rawBody: Buffer, headers: Record<string, string | undefined>): VerifiedEvent;
}

/** Turns one stored event into business changes. Must be idempotent: delivery is at-least-once. */
export abstract class InboundEventHandler {
  abstract readonly provider: string;
  abstract handle(event: InboundEvent): Promise<void>;
}
