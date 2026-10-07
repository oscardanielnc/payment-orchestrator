import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppConfig } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { ChargesModule } from './modules/charges/charges.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { IdentityModule } from './modules/identity/identity.module';
import { InboundModule } from './modules/inbound/inbound.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProblemDetailsFilter } from './shared/presentation/http/problem-details.filter';
import { QueueModule } from './shared/infrastructure/queue/queue.module';
import { SharedModule } from './shared/shared.module';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        SharedModule,
        QueueModule,
        IdentityModule,
        ChargesModule,
        PaymentsModule,
        CheckoutModule,
        LedgerModule,
        InboundModule,
      ],
      controllers: [HealthController],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    };
  }
}
