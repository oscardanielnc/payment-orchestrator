import { Injectable } from '@nestjs/common';
import { WebhookDeliveryNotFoundError } from '../../domain/errors';
import type { DeliveryAttempt, WebhookDelivery } from '../../domain/webhook-delivery';
import { WebhookDeliveryRepository } from '../ports/notification-ports';

@Injectable()
export class GetWebhookDeliveryUseCase {
  constructor(private readonly deliveries: WebhookDeliveryRepository) {}

  async execute(input: {
    organizationId: string;
    deliveryId: string;
  }): Promise<{ delivery: WebhookDelivery; attempts: DeliveryAttempt[] }> {
    const found = await this.deliveries.findForOrganization(input.organizationId, input.deliveryId);
    if (!found) throw new WebhookDeliveryNotFoundError();
    return found;
  }
}
