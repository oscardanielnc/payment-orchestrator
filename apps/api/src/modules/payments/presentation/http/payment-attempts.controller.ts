import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  type PaymentAttempt as PaymentAttemptResponse,
  type PaymentAttemptList,
  StartPaymentAttemptRequest,
} from '@po/contracts';
import { IdempotencyInterceptor } from '../../../../shared/presentation/http/idempotency.interceptor';
import { ZodValidationPipe } from '../../../../shared/presentation/http/zod-validation.pipe';
import { MerchantAuthGuard } from '../../../identity/presentation/http/merchant-auth.guard';
import { CurrentOrganization } from '../../../identity/presentation/http/current-organization.decorator';
import { ListPaymentAttemptsUseCase } from '../../application/use-cases/list-payment-attempts.use-case';
import { StartPaymentAttemptUseCase } from '../../application/use-cases/start-payment-attempt.use-case';
import type { PaymentAttempt } from '../../domain/payment-attempt';

function present(attempt: PaymentAttempt): PaymentAttemptResponse {
  return {
    id: attempt.id,
    object: 'payment_attempt',
    chargeId: attempt.chargeId,
    method: attempt.method,
    provider: attempt.provider,
    status: attempt.status,
    instructions: attempt.instructions,
    failureReason: attempt.failureReason,
    createdAt: attempt.createdAt.toISOString(),
  };
}

@Controller('charges/:chargeId/attempts')
@UseGuards(MerchantAuthGuard)
export class PaymentAttemptsController {
  constructor(
    private readonly startAttempt: StartPaymentAttemptUseCase,
    private readonly listAttempts: ListPaymentAttemptsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async start(
    @CurrentOrganization() organizationId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body(new ZodValidationPipe(StartPaymentAttemptRequest)) body: StartPaymentAttemptRequest,
  ): Promise<PaymentAttemptResponse> {
    const attempt = await this.startAttempt.execute({ organizationId, chargeId, ...body });
    return present(attempt);
  }

  @Get()
  async list(
    @CurrentOrganization() organizationId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
  ): Promise<PaymentAttemptList> {
    const attempts = await this.listAttempts.execute({ organizationId, chargeId });
    return { data: attempts.map(present) };
  }
}
