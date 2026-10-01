import { DynamicModule, Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

/**
 * Receives an already-validated config: validation happens in `main.ts` before
 * Nest starts, so an invalid environment never builds the DI container.
 */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: AppConfig, useValue: config }],
      exports: [AppConfig],
    };
  }
}
