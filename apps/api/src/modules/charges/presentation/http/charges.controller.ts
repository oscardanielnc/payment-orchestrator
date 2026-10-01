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
import { type Charge, type ChargeList, CreateChargeRequest, ListChargesQuery } from '@po/contracts';
import { IdempotencyInterceptor } from '../../../../shared/presentation/http/idempotency.interceptor';
import { ZodValidationPipe } from '../../../../shared/presentation/http/zod-validation.pipe';
import { ApiKeyGuard } from '../../../identity/presentation/http/api-key.guard';
import { CurrentOrganization } from '../../../identity/presentation/http/current-organization.decorator';
import { CreateChargeUseCase } from '../../application/use-cases/create-charge.use-case';
import { GetChargeUseCase } from '../../application/use-cases/get-charge.use-case';
import { ListChargesUseCase } from '../../application/use-cases/list-charges.use-case';
import { presentCharge } from './charge.presenter';

@Controller('charges')
@UseGuards(ApiKeyGuard)
export class ChargesController {
  constructor(
    private readonly createCharge: CreateChargeUseCase,
    private readonly getCharge: GetChargeUseCase,
    private readonly listCharges: ListChargesUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @CurrentOrganization() organizationId: string,
    @Body(new ZodValidationPipe(CreateChargeRequest)) body: CreateChargeRequest,
  ): Promise<Charge> {
    const charge = await this.createCharge.execute({ organizationId, ...body });
    return presentCharge(charge);
  }

  @Get(':id')
  async get(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) chargeId: string,
  ): Promise<Charge> {
    return presentCharge(await this.getCharge.execute({ organizationId, chargeId }));
  }

  @Get()
  async list(
    @CurrentOrganization() organizationId: string,
    @Query(new ZodValidationPipe(ListChargesQuery)) query: ListChargesQuery,
  ): Promise<ChargeList> {
    const page = await this.listCharges.execute({ organizationId, ...query });
    return { data: page.items.map(presentCharge), nextCursor: page.nextCursor };
  }
}
