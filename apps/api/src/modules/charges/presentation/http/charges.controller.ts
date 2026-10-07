import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  type Charge,
  type ChargeEventList,
  type ChargeList,
  CreateChargeRequest,
  ListChargesQuery,
} from '@po/contracts';
import { AppConfig } from '../../../../config/app-config';
import { IdempotencyInterceptor } from '../../../../shared/presentation/http/idempotency.interceptor';
import { ZodValidationPipe } from '../../../../shared/presentation/http/zod-validation.pipe';
import { MerchantAuthGuard } from '../../../identity/presentation/http/merchant-auth.guard';
import { CurrentOrganization } from '../../../identity/presentation/http/current-organization.decorator';
import { CreateChargeUseCase } from '../../application/use-cases/create-charge.use-case';
import { GetChargeUseCase } from '../../application/use-cases/get-charge.use-case';
import { ListChargeEventsUseCase } from '../../application/use-cases/list-charge-events.use-case';
import { ListChargesUseCase } from '../../application/use-cases/list-charges.use-case';
import type { Charge as ChargeEntity } from '../../domain/charge';
import { presentCharge } from './charge.presenter';

@Controller('charges')
@UseGuards(MerchantAuthGuard)
export class ChargesController {
  constructor(
    private readonly createCharge: CreateChargeUseCase,
    private readonly getCharge: GetChargeUseCase,
    private readonly listCharges: ListChargesUseCase,
    private readonly listEvents: ListChargeEventsUseCase,
    private readonly config: AppConfig,
  ) {}

  private present = (charge: ChargeEntity): Charge =>
    presentCharge(charge, this.config.checkoutBaseUrl);

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @CurrentOrganization() organizationId: string,
    @Body(new ZodValidationPipe(CreateChargeRequest)) body: CreateChargeRequest,
  ): Promise<Charge> {
    const charge = await this.createCharge.execute({ organizationId, ...body });
    return this.present(charge);
  }

  @Get(':id')
  async get(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) chargeId: string,
  ): Promise<Charge> {
    return this.present(await this.getCharge.execute({ organizationId, chargeId }));
  }

  @Get(':id/events')
  async events(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) chargeId: string,
  ): Promise<ChargeEventList> {
    const events = await this.listEvents.execute({ organizationId, chargeId });
    return { data: events.map((e) => ({ type: e.type, occurredAt: e.occurredAt.toISOString() })) };
  }

  @Get()
  async list(
    @CurrentOrganization() organizationId: string,
    @Query(new ZodValidationPipe(ListChargesQuery)) query: ListChargesQuery,
  ): Promise<ChargeList> {
    const page = await this.listCharges.execute({ organizationId, ...query });
    return { data: page.items.map(this.present), nextCursor: page.nextCursor };
  }
}
