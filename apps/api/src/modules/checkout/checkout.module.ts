import { Module } from '@nestjs/common';
import { ChargesModule } from '../charges/charges.module';
import { IdentityModule } from '../identity/identity.module';
import { PaymentsModule } from '../payments/payments.module';
import { GetCheckoutUseCase } from './application/use-cases/get-checkout.use-case';
import { StartCheckoutAttemptUseCase } from './application/use-cases/start-checkout-attempt.use-case';
import { CheckoutController } from './presentation/http/checkout.controller';

/** Hosted checkout (feature 11): public read model over charges, identity and payments. */
@Module({
  imports: [ChargesModule, IdentityModule, PaymentsModule],
  controllers: [CheckoutController],
  providers: [GetCheckoutUseCase, StartCheckoutAttemptUseCase],
})
export class CheckoutModule {}
