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
import { ListAvailableMethodsUseCase } from './application/use-cases/list-available-methods.use-case';
import { ListPaymentAttemptsUseCase } from './application/use-cases/list-payment-attempts.use-case';
import { ChainTransferHandler } from './application/handlers/chain-transfer.handler';
import { StripeEventHandler } from './application/handlers/stripe-event.handler';
import { IngestChainTransfersUseCase } from './application/use-cases/ingest-chain-transfers.use-case';
import { SettleChainTransferUseCase } from './application/use-cases/settle-chain-transfer.use-case';
import { SettleProviderPaymentUseCase } from './application/use-cases/settle-provider-payment.use-case';
import { StartPaymentAttemptUseCase } from './application/use-cases/start-payment-attempt.use-case';
import { SyncProviderPaymentsUseCase } from './application/use-cases/sync-provider-payments.use-case';
import { CryptoDepositProvider } from './infrastructure/providers/crypto-deposit.provider';
import { StripeCardProvider } from './infrastructure/providers/stripe/stripe-card.provider';
import {
  createStripeClient,
  STRIPE_CLIENT,
  type StripePaymentIntentsApi,
} from './infrastructure/providers/stripe/stripe-client';
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
      provide: STRIPE_CLIENT,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        config.stripe ? createStripeClient(config.stripe.secretKey) : null,
    },
    {
      provide: ENABLED_PAYMENT_PROVIDERS,
      inject: [AppConfig, DepositAddressesService, STRIPE_CLIENT],
      useFactory: (
        config: AppConfig,
        deposits: DepositAddressesService,
        stripe: StripePaymentIntentsApi | null,
      ) => [
        ...(config.tron ? [new CryptoDepositProvider('tron', 'tron-nile', 'USDT', deposits)] : []),
        ...(stripe ? [new StripeCardProvider(stripe)] : []),
      ],
    },
    { provide: PaymentAttemptRepository, useClass: PrismaPaymentAttemptRepository },
    StartPaymentAttemptUseCase,
    ListPaymentAttemptsUseCase,
    ListAvailableMethodsUseCase,
    IngestChainTransfersUseCase,
    SettleChainTransferUseCase,
    SettleProviderPaymentUseCase,
    SyncProviderPaymentsUseCase,
    // Handlers for inbound events this module understands; the worker plugs them into the queue.
    {
      provide: PAYMENT_INBOUND_HANDLERS,
      inject: [AppConfig, SettleChainTransferUseCase, SettleProviderPaymentUseCase],
      useFactory: (
        config: AppConfig,
        settleChain: SettleChainTransferUseCase,
        settleProvider: SettleProviderPaymentUseCase,
      ) => [
        ...(config.tron ? [new ChainTransferHandler('tron-nile', settleChain)] : []),
        ...(config.stripe ? [new StripeEventHandler(settleProvider)] : []),
      ],
    },
  ],
  exports: [
    StartPaymentAttemptUseCase,
    ListPaymentAttemptsUseCase,
    ListAvailableMethodsUseCase,
    IngestChainTransfersUseCase,
    SyncProviderPaymentsUseCase,
    PAYMENT_INBOUND_HANDLERS,
  ],
})
export class PaymentsModule {}
