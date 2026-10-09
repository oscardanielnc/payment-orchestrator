import { Injectable } from '@nestjs/common';
import type { WebhookEndpoint } from '../../domain/webhook-endpoint';
import { WebhookEndpointRepository } from '../ports/notification-ports';

@Injectable()
export class ListWebhookEndpointsUseCase {
  constructor(private readonly endpoints: WebhookEndpointRepository) {}

  execute(organizationId: string): Promise<WebhookEndpoint[]> {
    return this.endpoints.listForOrganization(organizationId);
  }
}
