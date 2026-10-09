import { type DynamicModule, type INestApplication, Module } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module';
import { loadConfig } from '../../src/config/load-config';
import { configureApp } from '../../src/configure-app';
import { QueueConsumersModule } from '../../src/worker/queue-consumers.module';

export interface TestAppOptions {
  /** Override providers, e.g. to inject a failure. */
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
  /** Extra environment variables. */
  env?: NodeJS.ProcessEnv;
  /** Also run the queue consumers and outbox relay, as the worker process would. */
  worker?: boolean;
}

@Module({})
class TestRootModule {}

/**
 * Boots the real app (same modules as production) against the e2e Postgres and Redis.
 * With `worker: true` the background half runs in the same process.
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication<App>> {
  const config = loadConfig({
    PAYMENTS_MODE: 'test',
    DATABASE_URL: inject('databaseUrl'),
    REDIS_URL: inject('redisUrl'),
    JWT_ACCESS_SECRET: 'e2e-access-secret-at-least-32-characters-long', // gitleaks:allow (fake)
    QUEUE_BACKOFF_MS: '20',
    WEBHOOK_SECRETS_KEY: Buffer.alloc(32, 7).toString('base64'), // fake key, not random
    WEBHOOK_BACKOFF_MS: '20',
    WEBHOOK_MAX_ATTEMPTS: '3',
    QUEUE_MAX_ATTEMPTS: '3',
    // Each app gets its own queues: test files run in parallel against one Redis.
    QUEUE_PREFIX: `test-${randomUUID().slice(0, 8)}`,
    ...options.env,
  });
  const root: DynamicModule = {
    module: TestRootModule,
    imports: [AppModule.register(config), ...(options.worker ? [QueueConsumersModule] : [])],
  };
  const customize = options.customize ?? ((builder) => builder);
  const moduleRef = await customize(Test.createTestingModule({ imports: [root] })).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
    rawBody: true,
  });
  configureApp(app, config);
  await app.init();
  return app;
}

/** Polls until `check` returns a value (or times out): background work is asynchronous. */
export async function eventually<T>(
  check: () => Promise<T | undefined | null | false>,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
