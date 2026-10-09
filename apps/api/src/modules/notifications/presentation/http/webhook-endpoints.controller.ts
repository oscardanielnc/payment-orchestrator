import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateWebhookEndpointRequest,
  type CreatedWebhookEndpoint,
  type WebhookEndpoint as WebhookEndpointResponse,
  type WebhookEndpointList,
} from '@po/contracts';
import { ZodValidationPipe } from '../../../../shared/presentation/http/zod-validation.pipe';
import { CurrentOrganization } from '../../../identity/presentation/http/current-organization.decorator';
import { MerchantAuthGuard } from '../../../identity/presentation/http/merchant-auth.guard';
import { Roles, RolesGuard } from '../../../identity/presentation/http/roles.guard';
import { CreateWebhookEndpointUseCase } from '../../application/use-cases/create-webhook-endpoint.use-case';
import { DisableWebhookEndpointUseCase } from '../../application/use-cases/disable-webhook-endpoint.use-case';
import { ListWebhookEndpointsUseCase } from '../../application/use-cases/list-webhook-endpoints.use-case';
import type { WebhookEndpoint } from '../../domain/webhook-endpoint';

const present = (endpoint: WebhookEndpoint): WebhookEndpointResponse => ({
  id: endpoint.id,
  url: endpoint.url,
  createdAt: endpoint.createdAt.toISOString(),
  disabledAt: endpoint.disabledAt?.toISOString() ?? null,
});

/** Endpoints manage a signing secret: owners only, signed in (an API key never passes). */
@Controller('webhook-endpoints')
@UseGuards(MerchantAuthGuard, RolesGuard)
@Roles('owner')
export class WebhookEndpointsController {
  constructor(
    private readonly createEndpoint: CreateWebhookEndpointUseCase,
    private readonly listEndpoints: ListWebhookEndpointsUseCase,
    private readonly disableEndpoint: DisableWebhookEndpointUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrganization() organizationId: string,
    @Body(new ZodValidationPipe(CreateWebhookEndpointRequest)) body: CreateWebhookEndpointRequest,
  ): Promise<CreatedWebhookEndpoint> {
    const { endpoint, secret } = await this.createEndpoint.execute({
      organizationId,
      url: body.url,
    });
    return { ...present(endpoint), secret };
  }

  @Get()
  async list(@CurrentOrganization() organizationId: string): Promise<WebhookEndpointList> {
    return { data: (await this.listEndpoints.execute(organizationId)).map(present) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disable(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) endpointId: string,
  ): Promise<void> {
    await this.disableEndpoint.execute({ organizationId, endpointId });
  }
}
