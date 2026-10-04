import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigError, loadConfig } from './config/load-config';
import { loadEnvFileIfPresent } from './config/load-env-file';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  loadEnvFileIfPresent();
  const config = loadConfig(process.env);

  // rawBody: webhook signatures are checked against the exact bytes received.
  const app = await NestFactory.create(AppModule.register(config), { rawBody: true });
  configureApp(app, config);
  app.enableShutdownHooks();
  await app.listen(config.apiPort);
}

bootstrap().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
});
