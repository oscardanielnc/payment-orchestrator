import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { GetChargeByCheckoutTokenUseCase } from '../../../charges/application/use-cases/get-charge-by-checkout-token.use-case';
import { ListPaymentAttemptsUseCase } from '../../../payments/application/use-cases/list-payment-attempts.use-case';
import { StartPaymentAttemptUseCase } from '../../../payments/application/use-cases/start-payment-attempt.use-case';
import type { PaymentAttempt } from '../../../payments/domain/payment-attempt';
import type { PaymentMethod } from '../../../payments/domain/payment-route';

/**
 * The customer picks a method. Picking the same method again (reload, double click, back
 * button) returns the open attempt instead of a new one: the same deposit address, the same
 * PaymentIntent. A new attempt is started only for a method without an open one.
 */
@Injectable()
export class StartCheckoutAttemptUseCase {
  constructor(
    private readonly charges: GetChargeByCheckoutTokenUseCase,
    private readonly attempts: ListPaymentAttemptsUseCase,
    private readonly startAttempt: StartPaymentAttemptUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(input: { token: string; method: PaymentMethod }): Promise<PaymentAttempt> {
    const charge = await this.charges.execute(input.token);
    const scope = { organizationId: charge.organizationId, chargeId: charge.id };

    const open = (await this.attempts.execute(scope)).findLast(
      (a) => a.method === input.method && a.status === 'pending',
    );
    // The charge's own rules (open, not expired) still apply when reusing: an expired
    // charge must not hand out its old address as if it were payable.
    if (open && charge.status === 'processing' && !charge.isExpiredAt(this.clock.now()))
      return open;

    return this.startAttempt.execute({ ...scope, method: input.method });
  }
}
