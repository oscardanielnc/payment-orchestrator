import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  ListWebhookDeliveriesQuery,
  type WebhookDelivery as WebhookDeliveryResponse,
  type WebhookDeliveryDetail,
  type WebhookDeliveryList,
} from '@po/contracts';
import { ZodValidationPipe } from '../../../../shared/presentation/http/zod-validation.pipe';
import { CurrentOrganization } from '../../../identity/presentation/http/current-organization.decorator';
import { MerchantAuthGuard } from '../../../identity/presentation/http/merchant-auth.guard';
import { GetWebhookDeliveryUseCase } from '../../application/use-cases/get-webhook-delivery.use-case';
import { ListWebhookDeliveriesUseCase } from '../../application/use-cases/list-webhook-deliveries.use-case';
import type { WebhookDelivery } from '../../domain/webhook-delivery';

const present = (delivery: WebhookDelivery): WebhookDeliveryResponse => ({
  id: delivery.id,
  endpointId: delivery.endpointId,
  eventId: delivery.eventId,
  eventType: delivery.eventType,
  status: delivery.status,
  attemptCount: delivery.attemptCount,
  lastStatusCode: delivery.lastStatusCode,
  lastError: delivery.lastError,
  createdAt: delivery.createdAt.toISOString(),
  deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
});

/** Read-only delivery log, for any member of the organization or its API keys. */
@Controller('webhook-deliveries')
@UseGuards(MerchantAuthGuard)
export class WebhookDeliveriesController {
  constructor(
    private readonly listDeliveries: ListWebhookDeliveriesUseCase,
    private readonly getDelivery: GetWebhookDeliveryUseCase,
  ) {}

  @Get()
  async list(
    @CurrentOrganization() organizationId: string,
    @Query(new ZodValidationPipe(ListWebhookDeliveriesQuery)) query: ListWebhookDeliveriesQuery,
  ): Promise<WebhookDeliveryList> {
    const page = await this.listDeliveries.execute({ organizationId, ...query });
    return { data: page.items.map(present), nextCursor: page.nextCursor };
  }

  @Get(':id')
  async get(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) deliveryId: string,
  ): Promise<WebhookDeliveryDetail> {
    const { delivery, attempts } = await this.getDelivery.execute({ organizationId, deliveryId });
    return {
      ...present(delivery),
      payload: delivery.payload,
      attempts: attempts.map((a) => ({ ...a, attemptedAt: a.attemptedAt.toISOString() })),
    };
  }
}
