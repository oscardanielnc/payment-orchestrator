import { z } from 'zod';

export const CreateWebhookEndpointRequest = z.strictObject({
  url: z.string().trim().min(1).max(2048),
});
export type CreateWebhookEndpointRequest = z.infer<typeof CreateWebhookEndpointRequest>;

export const WebhookEndpoint = z.object({
  id: z.uuid(),
  url: z.string(),
  createdAt: z.iso.datetime(),
  disabledAt: z.iso.datetime().nullable(),
});
export type WebhookEndpoint = z.infer<typeof WebhookEndpoint>;

export const WebhookEndpointList = z.object({ data: z.array(WebhookEndpoint) });
export type WebhookEndpointList = z.infer<typeof WebhookEndpointList>;

export const CreatedWebhookEndpoint = WebhookEndpoint.extend({
  /** Signing secret. Shown once: store it now, it cannot be retrieved later. */
  secret: z.string(),
});
export type CreatedWebhookEndpoint = z.infer<typeof CreatedWebhookEndpoint>;

export const WebhookDeliveryStatus = z.enum(['pending', 'succeeded', 'failed']);
export type WebhookDeliveryStatus = z.infer<typeof WebhookDeliveryStatus>;

export const WebhookDelivery = z.object({
  id: z.uuid(),
  endpointId: z.uuid(),
  /** Same on every retry: merchants deduplicate with it. */
  eventId: z.uuid(),
  eventType: z.string(),
  status: WebhookDeliveryStatus,
  attemptCount: z.number().int(),
  lastStatusCode: z.number().int().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.iso.datetime(),
  deliveredAt: z.iso.datetime().nullable(),
});
export type WebhookDelivery = z.infer<typeof WebhookDelivery>;

export const WebhookDeliveryList = z.object({
  data: z.array(WebhookDelivery),
  nextCursor: z.string().nullable(),
});
export type WebhookDeliveryList = z.infer<typeof WebhookDeliveryList>;

export const ListWebhookDeliveriesQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(200).optional(),
});
export type ListWebhookDeliveriesQuery = z.infer<typeof ListWebhookDeliveriesQuery>;

export const WebhookDeliveryAttempt = z.object({
  attemptedAt: z.iso.datetime(),
  /** `null`: no HTTP response (timeout, refused connection, DNS). */
  statusCode: z.number().int().nullable(),
  error: z.string().nullable(),
  durationMs: z.number().int(),
});
export type WebhookDeliveryAttempt = z.infer<typeof WebhookDeliveryAttempt>;

export const WebhookDeliveryDetail = WebhookDelivery.extend({
  /** The exact JSON body sent to the endpoint. */
  payload: z.string(),
  attempts: z.array(WebhookDeliveryAttempt),
});
export type WebhookDeliveryDetail = z.infer<typeof WebhookDeliveryDetail>;

/** The body merchants receive, signed in the `PO-Signature` header. */
export const WebhookEvent = z.object({
  id: z.uuid(),
  type: z.enum(['charge.succeeded', 'charge.failed', 'charge.expired']),
  createdAt: z.iso.datetime(),
  data: z.object({
    object: z.literal('charge'),
    id: z.uuid(),
    status: z.string(),
    amount: z.string(),
    currency: z.string(),
    reference: z.string().nullable(),
  }),
});
export type WebhookEvent = z.infer<typeof WebhookEvent>;
