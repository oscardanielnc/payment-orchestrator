import { DynamicModule, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { ConfigModule } from '../config/config.module';
import { CryptoModule } from '../modules/crypto/crypto.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { SharedModule } from '../shared/shared.module';
import { ChainWatcherService } from './chain-watcher.service';

/** Background work (ADR 0003). Same modules as the API, no HTTP. */
@Module({})
export class WorkerModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: WorkerModule,
      imports: [ConfigModule.forRoot(config), SharedModule, CryptoModule, PaymentsModule],
      providers: [ChainWatcherService],
    };
  }
}
