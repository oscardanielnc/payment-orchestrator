import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import type { DeliveryAttempt } from '../../domain/webhook-delivery';
import {
  WebhookDeliveryRepository,
  WebhookEndpointRepository,
  WebhookSecrets,
  WebhookSender,
  WebhookSigner,
} from '../ports/notification-ports';

/**
 * One attempt: sign with a fresh timestamp, POST, record. Returns the attempt, or `null`
 * when there was nothing to send (already delivered, or the endpoint was disabled).
 */
@Injectable()
export class DeliverWebhookUseCase {
  constructor(
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly endpoints: WebhookEndpointRepository,
    private readonly secrets: WebhookSecrets,
    private readonly signer: WebhookSigner,
    private readonly sender: WebhookSender,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    deliveryId: string;
    isLastAllowed: boolean;
  }): Promise<DeliveryAttempt | null> {
    const delivery = await this.deliveries.findById(input.deliveryId);
    if (!delivery?.isPending) return null; // at-least-once: duplicates of finished work happen

    const endpoint = await this.endpoints.findById(delivery.endpointId);
    if (!endpoint?.enabled) {
      delivery.abandon('Endpoint disabled', this.clock.now());
      await this.deliveries.save(delivery);
      return null;
    }

    const attemptedAt = this.clock.now();
    const signature = this.signer.sign(
      this.secrets.decrypt(endpoint.secretCiphertext),
      delivery.payload,
      Math.floor(attemptedAt.getTime() / 1000),
    );
    const result = await this.sender.send({
      url: endpoint.url,
      body: delivery.payload,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PaymentOrchestrator-Webhooks/1.0',
        'PO-Event-Id': delivery.eventId,
        'PO-Signature': signature,
      },
    });

    const attempt: DeliveryAttempt = { attemptedAt, ...result };
    delivery.recordAttempt(attempt, input.isLastAllowed);
    await this.deliveries.save(delivery);
    return attempt;
  }
}
