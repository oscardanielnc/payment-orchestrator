import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigError, loadConfig } from './config/load-config';
import { loadEnvFileIfPresent } from './config/load-env-file';

async function bootstrap(): Promise<void> {
  loadEnvFileIfPresent();
  const config = loadConfig(process.env);

  const app = await NestFactory.create(AppModule.register(config));
  app.setGlobalPrefix('v1');
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
