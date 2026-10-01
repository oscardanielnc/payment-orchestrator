import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module';
import { loadConfig } from '../../src/config/load-config';

/**
 * Boots the real app (same modules as production) against the e2e database.
 * `customize` can override a provider, e.g. to inject a failure.
 */
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<INestApplication<App>> {
  const config = loadConfig({
    PAYMENTS_MODE: 'test',
    DATABASE_URL: inject('databaseUrl'),
    REDIS_URL: 'redis://localhost:6379',
  });
  const moduleRef = await customize(
    Test.createTestingModule({ imports: [AppModule.register(config)] }),
  ).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  app.setGlobalPrefix('v1');
  await app.init();
  return app;
}
