/** A domain event as the outbox hands it over. */
export interface PublishedEvent {
  id: string;
  type: string;
  organizationId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

/**
 * What the merchant receives. Built once per event, so every endpoint and every retry gets
 * byte-identical JSON:
 *
 *   { "id": "<event id>", "type": "charge.succeeded", "createdAt": "...",
 *     "data": { "object": "charge", "id": "...", "status": "...", "amount": "...", ... } }
 */
export function buildWebhookPayload(event: PublishedEvent): string {
  const charge = event.payload;
  return JSON.stringify({
    id: event.id,
    type: event.type,
    createdAt: event.occurredAt,
    data: {
      object: 'charge',
      id: charge.chargeId,
      status: charge.status,
      amount: charge.amount,
      currency: charge.currency,
      reference: charge.reference ?? null,
    },
  });
}
