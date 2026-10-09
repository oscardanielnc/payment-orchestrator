/** Queues of the system (ADR 0008). */
export const QUEUES = {
  /** Provider webhooks and chain transfers, stored raw and processed by the worker. */
  inboundEvents: 'inbound-events',
  /** Domain events relayed from the outbox. */
  domainEvents: 'domain-events',
  /** Outbound merchant webhooks: one job per delivery, with its own longer backoff. */
  webhookDeliveries: 'webhook-deliveries',
  /** Jobs that exhausted their retries, kept for inspection and manual replay. */
  deadLetter: 'dead-letter',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * Background work. `jobId` makes enqueueing idempotent: the same id is accepted once while
 * the job exists, so a retried request or a re-relayed event does not run twice.
 */
export abstract class JobQueue {
  abstract enqueue(queue: QueueName, jobId: string, data: Record<string, unknown>): Promise<void>;
}
