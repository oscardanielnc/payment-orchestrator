import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { GetChargeByCheckoutTokenUseCase } from '../../../charges/application/use-cases/get-charge-by-checkout-token.use-case';
import type { Charge } from '../../../charges/domain/charge';
import type { ChargeStatus } from '../../../charges/domain/charge-status';
import { GetOrganizationUseCase } from '../../../identity/application/use-cases/get-organization.use-case';
import { ListAvailableMethodsUseCase } from '../../../payments/application/use-cases/list-available-methods.use-case';
import { ListPaymentAttemptsUseCase } from '../../../payments/application/use-cases/list-payment-attempts.use-case';
import type { PaymentAttempt } from '../../../payments/domain/payment-attempt';
import type { PaymentMethod } from '../../../payments/domain/payment-route';

export interface CheckoutView {
  charge: Charge;
  merchantName: string;
  /** What the customer should see now: a pending charge past its expiry is already expired. */
  status: ChargeStatus;
  methods: PaymentMethod[];
  attempt: PaymentAttempt | null;
}

/**
 * Everything the public checkout shows, composed from three modules' public APIs:
 *
 *   charges  → the charge behind the token
 *   identity → the merchant's name
 *   payments → enabled methods for the currency + the customer's current attempt
 */
@Injectable()
export class GetCheckoutUseCase {
  constructor(
    private readonly charges: GetChargeByCheckoutTokenUseCase,
    private readonly organizations: GetOrganizationUseCase,
    private readonly methods: ListAvailableMethodsUseCase,
    private readonly attempts: ListPaymentAttemptsUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(token: string): Promise<CheckoutView> {
    const charge = await this.charges.execute(token);
    const [organization, attempts] = await Promise.all([
      this.organizations.execute(charge.organizationId),
      this.attempts.execute({ organizationId: charge.organizationId, chargeId: charge.id }),
    ]);

    return {
      charge,
      merchantName: organization.name,
      status: effectiveStatus(charge, this.clock.now()),
      methods: this.methods.execute(charge.amount.currency),
      attempt: currentAttempt(attempts),
    };
  }
}

export function effectiveStatus(charge: Charge, now: Date): ChargeStatus {
  return charge.status === 'pending' && charge.isExpiredAt(now) ? 'expired' : charge.status;
}

/** The one that paid, else the newest open one, else the newest. Attempts come oldest first. */
function currentAttempt(attempts: PaymentAttempt[]): PaymentAttempt | null {
  return (
    attempts.find((a) => a.status === 'succeeded') ??
    attempts.findLast((a) => a.status === 'pending') ??
    attempts.at(-1) ??
    null
  );
}
