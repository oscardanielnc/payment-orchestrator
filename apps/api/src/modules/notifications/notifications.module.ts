import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { IdentityModule } from '../identity/identity.module';
import {
  NotificationSettings,
  WebhookDeliveryRepository,
  WebhookEndpointRepository,
  WebhookSecrets,
  WebhookSender,
  WebhookSigner,
} from './application/ports/notification-ports';
import { CreateWebhookEndpointUseCase } from './application/use-cases/create-webhook-endpoint.use-case';
import { DeliverWebhookUseCase } from './application/use-cases/deliver-webhook.use-case';
import { DisableWebhookEndpointUseCase } from './application/use-cases/disable-webhook-endpoint.use-case';
import { FanOutEventUseCase } from './application/use-cases/fan-out-event.use-case';
import { GetWebhookDeliveryUseCase } from './application/use-cases/get-webhook-delivery.use-case';
import { ListWebhookDeliveriesUseCase } from './application/use-cases/list-webhook-deliveries.use-case';
import { ListWebhookEndpointsUseCase } from './application/use-cases/list-webhook-endpoints.use-case';
import { RequeueLostDeliveriesUseCase } from './application/use-cases/requeue-lost-deliveries.use-case';
import { AesGcmWebhookSecrets, HmacWebhookSigner } from './infrastructure/crypto/webhook-crypto';
import { FetchWebhookSender } from './infrastructure/http/fetch-webhook-sender';
import { PrismaWebhookDeliveryRepository } from './infrastructure/persistence/prisma/prisma-webhook-delivery.repository';
import { PrismaWebhookEndpointRepository } from './infrastructure/persistence/prisma/prisma-webhook-endpoint.repository';
import { WebhookDeliveriesController } from './presentation/http/webhook-deliveries.controller';
import { WebhookEndpointsController } from './presentation/http/webhook-endpoints.controller';

/** Outbound merchant webhooks (feature 14, ADR 0018). */
@Module({
  imports: [IdentityModule],
  controllers: [WebhookEndpointsController, WebhookDeliveriesController],
  providers: [
    { provide: WebhookEndpointRepository, useClass: PrismaWebhookEndpointRepository },
    { provide: WebhookDeliveryRepository, useClass: PrismaWebhookDeliveryRepository },
    { provide: WebhookSecrets, useClass: AesGcmWebhookSecrets },
    { provide: WebhookSigner, useClass: HmacWebhookSigner },
    { provide: WebhookSender, useClass: FetchWebhookSender },
    {
      provide: NotificationSettings,
      inject: [AppConfig],
      useFactory: (config: AppConfig): NotificationSettings => ({
        allowLocalHttp: config.webhooks.allowLocalHttp,
      }),
    },
    CreateWebhookEndpointUseCase,
    ListWebhookEndpointsUseCase,
    DisableWebhookEndpointUseCase,
    FanOutEventUseCase,
    DeliverWebhookUseCase,
    RequeueLostDeliveriesUseCase,
    ListWebhookDeliveriesUseCase,
    GetWebhookDeliveryUseCase,
  ],
  // The worker drives these from its queue consumers.
  exports: [FanOutEventUseCase, DeliverWebhookUseCase, RequeueLostDeliveriesUseCase],
})
export class NotificationsModule {}
