import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/load-config';

describe('GET /v1/health', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const config = loadConfig({
      PAYMENTS_MODE: 'test',
      DATABASE_URL: 'postgresql://orchestrator:orchestrator@localhost:5432/orchestrator',
      REDIS_URL: 'redis://localhost:6379',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the app is up in test mode', async () => {
    await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200, { status: 'ok', paymentsMode: 'test' });
  });
});
