import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { RevokeApiKeyUseCase } from '../src/modules/identity/application/use-cases/revoke-api-key.use-case';
import { createTestApp } from './setup/create-test-app';

describe('API key authentication (real Postgres)', () => {
  let app: INestApplication<App>;
  let acme: { id: string; apiKeyId: string; token: string };
  let globex: { id: string; token: string };

  beforeAll(async () => {
    app = await createTestApp();
    const create = app.get(CreateOrganizationUseCase);
    const a = await create.execute({ name: 'Acme Coffee' });
    const g = await create.execute({ name: 'Globex' });
    acme = { id: a.organization.id, apiKeyId: a.apiKeyId, token: a.token };
    globex = { id: g.organization.id, token: g.token };
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, token?: string) => {
    const call = request(app.getHttpServer()).get(path);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  it('scopes every request to the key owner', async () => {
    const asAcme = await get('/v1/organization', acme.token).expect(200);
    const asGlobex = await get('/v1/organization', globex.token).expect(200);

    expect(asAcme.body).toMatchObject({ id: acme.id, name: 'Acme Coffee' });
    expect(asGlobex.body).toMatchObject({ id: globex.id, name: 'Globex' });
  });

  it("lists only the caller's keys, showing the prefix and never the secret", async () => {
    const response = await get('/v1/api-keys', acme.token).expect(200);

    const body = response.body as { data: unknown[] };
    expect(body.data).toEqual([
      expect.objectContaining({ id: acme.apiKeyId, prefix: `po_test_${acme.apiKeyId}` }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain(acme.token);
  });

  it.each([
    ['missing', undefined],
    ['malformed', 'not-a-key'],
  ])('answers 401 Problem Details for a %s key', async (_label, token) => {
    const response = await get('/v1/organization', token).expect(401);

    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({ status: 401, code: 'api_key.invalid' });
  });

  it('rejects a key as soon as it is revoked', async () => {
    const extra = await app.get(CreateOrganizationUseCase).execute({ name: 'Initech' });
    await get('/v1/organization', extra.token).expect(200);

    await app
      .get(RevokeApiKeyUseCase)
      .execute({ organizationId: extra.organization.id, apiKeyId: extra.apiKeyId });

    await get('/v1/organization', extra.token).expect(401);
  });
});
