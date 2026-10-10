import { DynamicModule, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { ConfigModule } from '../config/config.module';
import { ChargesModule } from '../modules/charges/charges.module';
import { CryptoModule } from '../modules/crypto/crypto.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { QueueModule } from '../shared/infrastructure/queue/queue.module';
import { SharedModule } from '../shared/shared.module';
import { ChainWatcherService } from './chain-watcher.service';
import { ChargeExpiryService } from './charge-expiry.service';
import { ProviderPaymentSyncService } from './provider-payment-sync.service';
import { QueueConsumersModule } from './queue-consumers.module';

/** Background work (ADR 0003): chain watchers, queue consumers, outbox relay, sweeps. No HTTP. */
@Module({})
export class WorkerModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        ConfigModule.forRoot(config),
        SharedModule,
        QueueModule,
        CryptoModule,
        ChargesModule,
        PaymentsModule,
        QueueConsumersModule,
      ],
      providers: [ChainWatcherService, ChargeExpiryService, ProviderPaymentSyncService],
    };
  }
}
