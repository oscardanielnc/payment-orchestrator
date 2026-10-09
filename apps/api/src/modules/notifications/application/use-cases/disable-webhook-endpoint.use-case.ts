import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { WebhookEndpointNotFoundError } from '../../domain/errors';
import { WebhookEndpointRepository } from '../ports/notification-ports';

/** Stops future deliveries; pending ones are abandoned at their next attempt. */
@Injectable()
export class DisableWebhookEndpointUseCase {
  constructor(
    private readonly endpoints: WebhookEndpointRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { organizationId: string; endpointId: string }): Promise<void> {
    const endpoint = await this.endpoints.findForOrganization(
      input.organizationId,
      input.endpointId,
    );
    if (!endpoint) throw new WebhookEndpointNotFoundError();
    endpoint.disable(this.clock.now());
    await this.endpoints.save(endpoint);
  }
}
