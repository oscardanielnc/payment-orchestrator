import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { WebhookEndpoint } from '../../domain/webhook-endpoint';
import {
  NotificationSettings,
  WebhookEndpointRepository,
  WebhookSecrets,
} from '../ports/notification-ports';

/** Registers an endpoint. The secret is returned here once and never again. */
@Injectable()
export class CreateWebhookEndpointUseCase {
  constructor(
    private readonly endpoints: WebhookEndpointRepository,
    private readonly secrets: WebhookSecrets,
    private readonly settings: NotificationSettings,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    organizationId: string;
    url: string;
  }): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
    const secret = this.secrets.generate();
    const endpoint = WebhookEndpoint.create({
      id: this.ids.uuid(),
      organizationId: input.organizationId,
      url: input.url,
      secretCiphertext: this.secrets.encrypt(secret),
      allowLocalHttp: this.settings.allowLocalHttp,
      now: this.clock.now(),
    });
    await this.endpoints.save(endpoint);
    return { endpoint, secret };
  }
}
