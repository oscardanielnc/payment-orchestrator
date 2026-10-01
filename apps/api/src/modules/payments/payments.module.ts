import { Module } from '@nestjs/common';
import { ChargesModule } from '../charges/charges.module';
import { IdentityModule } from '../identity/identity.module';
import { PaymentAttemptRepository } from './application/ports/payment-attempt.repository';
import { PaymentProviderRegistry } from './application/ports/payment-provider-registry';
import { RoutingTable } from './application/ports/routing-table';
import { ListPaymentAttemptsUseCase } from './application/use-cases/list-payment-attempts.use-case';
import { StartPaymentAttemptUseCase } from './application/use-cases/start-payment-attempt.use-case';
import { PrismaPaymentAttemptRepository } from './infrastructure/persistence/prisma/prisma-payment-attempt.repository';
import {
  ENABLED_PAYMENT_PROVIDERS,
  EnabledProvidersRegistry,
} from './infrastructure/providers/enabled-providers.registry';
import { StaticRoutingTable } from './infrastructure/routing/payment-routes';
import { PaymentAttemptsController } from './presentation/http/payment-attempts.controller';

@Module({
  imports: [IdentityModule, ChargesModule],
  controllers: [PaymentAttemptsController],
  providers: [
    { provide: RoutingTable, useClass: StaticRoutingTable },
    { provide: PaymentProviderRegistry, useClass: EnabledProvidersRegistry },
    // Empty until the provider features (7, 8, 12, 13) register their adapters.
    { provide: ENABLED_PAYMENT_PROVIDERS, useValue: [] },
    { provide: PaymentAttemptRepository, useClass: PrismaPaymentAttemptRepository },
    StartPaymentAttemptUseCase,
    ListPaymentAttemptsUseCase,
  ],
  exports: [StartPaymentAttemptUseCase],
})
export class PaymentsModule {}
