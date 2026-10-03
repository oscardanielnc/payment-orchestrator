import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { ChargesModule } from '../charges/charges.module';
import { DepositAddressesService } from '../crypto/application/services/deposit-addresses.service';
import { CryptoModule } from '../crypto/crypto.module';
import { IdentityModule } from '../identity/identity.module';
import { InboundModule } from '../inbound/inbound.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentAttemptRepository } from './application/ports/payment-attempt.repository';
import { PaymentProviderRegistry } from './application/ports/payment-provider-registry';
import { RoutingTable } from './application/ports/routing-table';
import { ListPaymentAttemptsUseCase } from './application/use-cases/list-payment-attempts.use-case';
import { ChainTransferHandler } from './application/handlers/chain-transfer.handler';
import { IngestChainTransfersUseCase } from './application/use-cases/ingest-chain-transfers.use-case';
import { SettleChainTransferUseCase } from './application/use-cases/settle-chain-transfer.use-case';
import { StartPaymentAttemptUseCase } from './application/use-cases/start-payment-attempt.use-case';
import { CryptoDepositProvider } from './infrastructure/providers/crypto-deposit.provider';
import { PrismaPaymentAttemptRepository } from './infrastructure/persistence/prisma/prisma-payment-attempt.repository';
import {
  ENABLED_PAYMENT_PROVIDERS,
  EnabledProvidersRegistry,
} from './infrastructure/providers/enabled-providers.registry';
import { StaticRoutingTable } from './infrastructure/routing/payment-routes';
import { PaymentAttemptsController } from './presentation/http/payment-attempts.controller';

/** Inbound event handlers owned by payments (chain transfers now; Stripe and Mercado Pago later). */
export const PAYMENT_INBOUND_HANDLERS = Symbol('PAYMENT_INBOUND_HANDLERS');

@Module({
  imports: [IdentityModule, ChargesModule, CryptoModule, LedgerModule, InboundModule],
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
    IngestChainTransfersUseCase,
    SettleChainTransferUseCase,
    // Handlers for inbound events this module understands; the worker plugs them into the queue.
    {
      provide: PAYMENT_INBOUND_HANDLERS,
      inject: [AppConfig, SettleChainTransferUseCase],
      useFactory: (config: AppConfig, settle: SettleChainTransferUseCase) => [
        ...(config.tron ? [new ChainTransferHandler('tron-nile', settle)] : []),
      ],
    },
  ],
  exports: [StartPaymentAttemptUseCase, IngestChainTransfersUseCase, PAYMENT_INBOUND_HANDLERS],
})
export class PaymentsModule {}
