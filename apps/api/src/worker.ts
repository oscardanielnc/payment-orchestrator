import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigError, loadConfig } from './config/load-config';
import { loadEnvFileIfPresent } from './config/load-env-file';
import { WorkerModule } from './worker/worker.module';

async function bootstrap(): Promise<void> {
  loadEnvFileIfPresent();
  const config = loadConfig(process.env);

  const app = await NestFactory.createApplicationContext(WorkerModule.register(config));
  app.enableShutdownHooks();
}

bootstrap().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
});
