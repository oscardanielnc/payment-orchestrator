import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiKeyRepository } from '../src/modules/identity/application/ports/api-key.repository';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { PrismaApiKeyRepository } from '../src/modules/identity/infrastructure/persistence/prisma/prisma-api-key.repository';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from './setup/create-test-app';

/** Fails on purpose after the organization row was written in the same transaction. */
class FailingApiKeyRepository extends PrismaApiKeyRepository {
  override save(): Promise<void> {
    return Promise.reject(new Error('disk full'));
  }
}

describe('unit of work (ADR 0004)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(ApiKeyRepository).useClass(FailingApiKeyRepository),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('rolls back the organization when saving its first key fails', async () => {
    const name = `Rollback ${Date.now()}`;

    await expect(app.get(CreateOrganizationUseCase).execute({ name })).rejects.toThrow('disk full');

    const stored = await app.get(PrismaService).organization.count({ where: { name } });
    expect(stored).toBe(0);
  });
});
