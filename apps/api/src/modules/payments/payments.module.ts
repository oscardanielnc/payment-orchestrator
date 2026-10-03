import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { ChargesModule } from '../charges/charges.module';
import { DepositAddressesService } from '../crypto/application/services/deposit-addresses.service';
import { CryptoModule } from '../crypto/crypto.module';
import { IdentityModule } from '../identity/identity.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentAttemptRepository } from './application/ports/payment-attempt.repository';
import { PaymentProviderRegistry } from './application/ports/payment-provider-registry';
import { RoutingTable } from './application/ports/routing-table';
import { ListPaymentAttemptsUseCase } from './application/use-cases/list-payment-attempts.use-case';
import { ProcessChainTransfersUseCase } from './application/use-cases/process-chain-transfers.use-case';
import { StartPaymentAttemptUseCase } from './application/use-cases/start-payment-attempt.use-case';
import { CryptoDepositProvider } from './infrastructure/providers/crypto-deposit.provider';
import { PrismaPaymentAttemptRepository } from './infrastructure/persistence/prisma/prisma-payment-attempt.repository';
import {
  ENABLED_PAYMENT_PROVIDERS,
  EnabledProvidersRegistry,
} from './infrastructure/providers/enabled-providers.registry';
import { StaticRoutingTable } from './infrastructure/routing/payment-routes';
import { PaymentAttemptsController } from './presentation/http/payment-attempts.controller';

@Module({
  imports: [IdentityModule, ChargesModule, CryptoModule, LedgerModule],
  controllers: [PaymentAttemptsController],
  providers: [
    { provide: RoutingTable, useClass: StaticRoutingTable },
    { provide: PaymentProviderRegistry, useClass: EnabledProvidersRegistry },
    // Only providers whose configuration is present. Features 7, 12 and 13 add theirs here.
    {
      provide: ENABLED_PAYMENT_PROVIDERS,
      inject: [AppConfig, DepositAddressesService],
      useFactory: (config: AppConfig, deposits: DepositAddressesService) => [
        ...(config.tron ? [new CryptoDepositProvider('tron', 'tron-nile', 'USDT', deposits)] : []),
      ],
    },
    { provide: PaymentAttemptRepository, useClass: PrismaPaymentAttemptRepository },
    StartPaymentAttemptUseCase,
    ListPaymentAttemptsUseCase,
    ProcessChainTransfersUseCase,
  ],
  exports: [StartPaymentAttemptUseCase, ProcessChainTransfersUseCase],
})
export class PaymentsModule {}
