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
import {
  MERCADOPAGO_CLIENT,
  type MercadoPagoApi,
  MercadoPagoHttpClient,
} from './infrastructure/providers/mercadopago/mercadopago-client';
import { MercadoPagoEventHandler } from './infrastructure/providers/mercadopago/mercadopago-event.handler';
import { MercadoPagoTestUserCheck } from './infrastructure/providers/mercadopago/mercadopago-test-user.check';
import { MercadoPagoProvider } from './infrastructure/providers/mercadopago/mercadopago.provider';
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

/** Inbound event handlers owned by payments: chain transfers, Stripe and Mercado Pago. */
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
      provide: MERCADOPAGO_CLIENT,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        config.mercadopago ? new MercadoPagoHttpClient(config.mercadopago.accessToken) : null,
    },
    // ADR 0022: refuses to start unless the Mercado Pago token belongs to a test user.
    {
      provide: MercadoPagoTestUserCheck,
      inject: [MERCADOPAGO_CLIENT],
      useFactory: (mercadopago: MercadoPagoApi | null) =>
        mercadopago ? new MercadoPagoTestUserCheck(mercadopago) : null,
    },
    {
      provide: ENABLED_PAYMENT_PROVIDERS,
      inject: [AppConfig, DepositAddressesService, STRIPE_CLIENT, MERCADOPAGO_CLIENT],
      useFactory: (
        config: AppConfig,
        deposits: DepositAddressesService,
        stripe: StripePaymentIntentsApi | null,
        mercadopago: MercadoPagoApi | null,
      ) => [
        ...(config.tron ? [new CryptoDepositProvider('tron', 'tron-nile', 'USDT', deposits)] : []),
        ...(config.base
          ? [new CryptoDepositProvider('base', 'base-sepolia', 'USDC', deposits)]
          : []),
        ...(stripe ? [new StripeCardProvider(stripe)] : []),
        ...(mercadopago ? [new MercadoPagoProvider(mercadopago)] : []),
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
      inject: [
        AppConfig,
        SettleChainTransferUseCase,
        SettleProviderPaymentUseCase,
        MERCADOPAGO_CLIENT,
      ],
      useFactory: (
        config: AppConfig,
        settleChain: SettleChainTransferUseCase,
        settleProvider: SettleProviderPaymentUseCase,
        mercadopago: MercadoPagoApi | null,
      ) => [
        ...(config.tron ? [new ChainTransferHandler('tron-nile', settleChain)] : []),
        ...(config.base ? [new ChainTransferHandler('base-sepolia', settleChain)] : []),
        ...(config.stripe ? [new StripeEventHandler(settleProvider)] : []),
        ...(mercadopago ? [new MercadoPagoEventHandler(mercadopago, settleProvider)] : []),
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
    STRIPE_CLIENT,
    MERCADOPAGO_CLIENT,
  ],
})
export class PaymentsModule {}
