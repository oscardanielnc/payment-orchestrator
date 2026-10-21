import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { DepositBalancesService } from '../crypto/application/services/deposit-balances.service';
import { CryptoModule } from '../crypto/crypto.module';
import { IdentityModule } from '../identity/identity.module';
import { LedgerService } from '../ledger/application/services/ledger.service';
import { LedgerModule } from '../ledger/ledger.module';
import {
  MERCADOPAGO_CLIENT,
  type MercadoPagoApi,
} from '../payments/infrastructure/providers/mercadopago/mercadopago-client';
import {
  STRIPE_CLIENT,
  type StripePaymentIntentsApi,
} from '../payments/infrastructure/providers/stripe/stripe-client';
import { PaymentsModule } from '../payments/payments.module';
import {
  FindingRepository,
  ReconciliationRunRepository,
  ReconciliationSources,
} from './application/ports/reconciliation-ports';
import { ListFindingsUseCase } from './application/use-cases/list-findings.use-case';
import { ReconcilePreviousDayUseCase } from './application/use-cases/reconcile-previous-day.use-case';
import { ResolveFindingUseCase } from './application/use-cases/resolve-finding.use-case';
import { RunReconciliationUseCase } from './application/use-cases/run-reconciliation.use-case';
import {
  PrismaFindingRepository,
  PrismaReconciliationRunRepository,
} from './infrastructure/persistence/prisma-reconciliation.repositories';
import { ChainReconciliationSource } from './infrastructure/sources/chain-reconciliation.source';
import { ConfiguredReconciliationSources } from './infrastructure/sources/configured-reconciliation-sources';
import { MercadoPagoReconciliationSource } from './infrastructure/sources/mercadopago-reconciliation.source';
import { StripeReconciliationSource } from './infrastructure/sources/stripe-reconciliation.source';
import { ReconciliationFindingsController } from './presentation/http/reconciliation-findings.controller';

/** Feature 15 (ADR 0021): compares providers with the ledger; findings never move money. */
@Module({
  imports: [IdentityModule, LedgerModule, CryptoModule, PaymentsModule],
  controllers: [ReconciliationFindingsController],
  providers: [
    {
      provide: ReconciliationSources,
      inject: [AppConfig, STRIPE_CLIENT, MERCADOPAGO_CLIENT, DepositBalancesService, LedgerService],
      useFactory: (
        config: AppConfig,
        stripe: StripePaymentIntentsApi | null,
        mercadopago: MercadoPagoApi | null,
        deposits: DepositBalancesService,
        ledger: LedgerService,
      ) =>
        new ConfiguredReconciliationSources([
          ...(stripe ? [new StripeReconciliationSource(stripe, ledger)] : []),
          ...(mercadopago ? [new MercadoPagoReconciliationSource(mercadopago, ledger)] : []),
          ...(config.tron ? [new ChainReconciliationSource('tron-nile', deposits, ledger)] : []),
          ...(config.base ? [new ChainReconciliationSource('base-sepolia', deposits, ledger)] : []),
        ]),
    },
    { provide: FindingRepository, useClass: PrismaFindingRepository },
    { provide: ReconciliationRunRepository, useClass: PrismaReconciliationRunRepository },
    RunReconciliationUseCase,
    ReconcilePreviousDayUseCase,
    ListFindingsUseCase,
    ResolveFindingUseCase,
  ],
  exports: [RunReconciliationUseCase, ReconcilePreviousDayUseCase],
})
export class ReconciliationModule {}
