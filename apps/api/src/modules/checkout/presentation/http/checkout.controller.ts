import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  type CheckoutAttempt,
  type CheckoutSession,
  CheckoutToken,
  StartCheckoutAttemptRequest,
} from '@po/contracts';
import { AppConfig } from '../../../../config/app-config';
import { ZodValidationPipe } from '../../../../shared/presentation/http/zod-validation.pipe';
import { ChargeNotFoundError } from '../../../charges/domain/errors';
import type { PaymentAttempt } from '../../../payments/domain/payment-attempt';
import { GetCheckoutUseCase } from '../../application/use-cases/get-checkout.use-case';
import { StartCheckoutAttemptUseCase } from '../../application/use-cases/start-checkout-attempt.use-case';

const presentAttempt = (attempt: PaymentAttempt): CheckoutAttempt => ({
  method: attempt.method,
  status: attempt.status,
  instructions: attempt.instructions,
  failureReason: attempt.failureReason,
});

/** A malformed token gets the same 404 as an unknown one: nothing to learn by probing. */
function validToken(token: string): string {
  if (!CheckoutToken.safeParse(token).success) throw new ChargeNotFoundError();
  return token;
}

/**
 * Public: no API key, no session. The unguessable token in the URL is the capability.
 * Rate-limited per IP; the page polls every 3 s (ADR 0012), well under the GET limit.
 */
@Controller('checkout')
@UseGuards(ThrottlerGuard)
export class CheckoutController {
  constructor(
    private readonly getCheckout: GetCheckoutUseCase,
    private readonly startAttempt: StartCheckoutAttemptUseCase,
    private readonly config: AppConfig,
  ) {}

  @Get(':token')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async get(@Param('token') token: string): Promise<CheckoutSession> {
    const view = await this.getCheckout.execute(validToken(token));
    return {
      merchantName: view.merchantName,
      amount: view.charge.amount.toMinorUnits(),
      currency: view.charge.amount.currency as CheckoutSession['currency'],
      description: view.charge.description,
      status: view.status,
      expiresAt: view.charge.expiresAt.toISOString(),
      methods: view.methods,
      attempt: view.attempt ? presentAttempt(view.attempt) : null,
      stripePublishableKey: view.methods.includes('card')
        ? (this.config.stripe?.publishableKey ?? null)
        : null,
    };
  }

  /** Same method twice returns the same open attempt, so no Idempotency-Key is needed here. */
  @Post(':token/attempts')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async start(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(StartCheckoutAttemptRequest)) body: StartCheckoutAttemptRequest,
  ): Promise<CheckoutAttempt> {
    const attempt = await this.startAttempt.execute({
      token: validToken(token),
      method: body.method,
    });
    return presentAttempt(attempt);
  }
}
