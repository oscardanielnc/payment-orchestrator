import type { INestApplication } from '@nestjs/common';
import type { AccessTokenResponse, CreatedApiKey } from '@po/contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { CreateUserUseCase } from '../src/modules/identity/application/use-cases/create-user.use-case';
import { createTestApp } from './setup/create-test-app';

const OWNER_PASSWORD = 'owner-password-for-tests'; // gitleaks:allow (fake test password)
const MEMBER_PASSWORD = 'member-password-for-tests'; // gitleaks:allow (fake test password)

describe('Dashboard auth (real Postgres)', () => {
  let app: INestApplication<App>;
  let apiKey: string;
  const owner = `owner-${Date.now()}@acme.test`;
  const member = `member-${Date.now()}@acme.test`;

  beforeAll(async () => {
    app = await createTestApp({ env: { LOGIN_RATE_LIMIT_PER_MINUTE: '100' } });
    const org = await app.get(CreateOrganizationUseCase).execute({ name: 'Acme Auth' });
    apiKey = org.token;
    const users = app.get(CreateUserUseCase);
    await users.execute({
      organizationId: org.organization.id,
      email: owner,
      password: OWNER_PASSWORD,
      role: 'owner',
    });
    await users.execute({
      organizationId: org.organization.id,
      email: member,
      password: MEMBER_PASSWORD,
      role: 'member',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const login = (email: string, password: string) =>
    http().post('/v1/auth/login').send({ email, password });
  const refreshCookieOf = (response: request.Response) =>
    ([] as string[])
      .concat(response.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('po_refresh='));
  const cookieValue = (setCookie: string | undefined) => setCookie?.split(';')[0] ?? '';
  const refresh = (cookie: string) => http().post('/v1/auth/refresh').set('Cookie', cookie);

  it('signs in: access token in the body, refresh token only in a hardened cookie', async () => {
    const response = await login(owner, OWNER_PASSWORD).expect(200);
    const body = response.body as AccessTokenResponse;

    expect(body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email: owner, role: 'owner' },
    });
    expect(JSON.stringify(body)).not.toContain('po_refresh');
    const cookie = refreshCookieOf(response) ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/v1\/auth/i);
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const unknown = await login('nobody@acme.test', OWNER_PASSWORD).expect(401);
    const wrong = await login(owner, 'wrong-password-123').expect(401);

    expect(unknown.body).toEqual(wrong.body);
    expect(wrong.body).toMatchObject({ code: 'auth.invalid_credentials' });
  });

  it('lets a signed-in user read merchant endpoints with the access token', async () => {
    const { accessToken } = (await login(member, MEMBER_PASSWORD).expect(200))
      .body as AccessTokenResponse;
    const auth = { Authorization: `Bearer ${accessToken}` };

    await http().get('/v1/auth/me').set(auth).expect(200);
    await http().get('/v1/charges').set(auth).expect(200);
    await http().get('/v1/balances').set(auth).expect(200);
  });

  it('rotates the refresh token, and revokes the whole session when an old one is reused', async () => {
    const first = cookieValue(refreshCookieOf(await login(owner, OWNER_PASSWORD).expect(200)));

    const rotated = await refresh(first).expect(200);
    const second = cookieValue(refreshCookieOf(rotated));
    expect(second).not.toBe(first);
    expect((rotated.body as AccessTokenResponse).accessToken).toBeTruthy();

    // An attacker replays the first token: rejected, and the family is revoked...
    const reuse = await refresh(first).expect(401);
    expect(reuse.body).toMatchObject({ code: 'auth.invalid_session' });
    // ...so the legitimate, newer token stops working too.
    await refresh(second).expect(401);
  });

  it('ends the session on logout', async () => {
    const cookie = cookieValue(refreshCookieOf(await login(owner, OWNER_PASSWORD).expect(200)));

    await http().post('/v1/auth/logout').set('Cookie', cookie).expect(204);

    await refresh(cookie).expect(401);
  });

  it('lets an owner issue and revoke API keys', async () => {
    const { accessToken } = (await login(owner, OWNER_PASSWORD).expect(200))
      .body as AccessTokenResponse;
    const auth = { Authorization: `Bearer ${accessToken}` };

    const created = (
      await http()
        .post('/v1/api-keys')
        .set(auth)
        .set('Idempotency-Key', `key-${Date.now()}`)
        .send({ name: 'Server' })
        .expect(201)
    ).body as CreatedApiKey;
    expect(created.token).toMatch(/^po_test_/);
    await http()
      .get('/v1/organization')
      .set('Authorization', `Bearer ${created.token}`)
      .expect(200);

    await http().delete(`/v1/api-keys/${created.id}`).set(auth).expect(204);
    await http()
      .get('/v1/organization')
      .set('Authorization', `Bearer ${created.token}`)
      .expect(401);
  });

  it.each([
    [
      'a member',
      async () => ((await login(member, MEMBER_PASSWORD)).body as AccessTokenResponse).accessToken,
    ],
    ['an API key', () => Promise.resolve(apiKey)],
  ])('forbids %s from issuing API keys', async (_label, credential) => {
    const token = await credential(); // resolved first: supertest runs one request at a time here
    const response = await http()
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `forbidden-${Date.now()}`)
      .send({ name: 'Nope' })
      .expect(403);

    expect(response.body).toMatchObject({ code: 'auth.forbidden' });
  });

  it.each([
    ['a tampered token', (token: string) => `${token.slice(0, -2)}xx`],
    [
      'an unsigned "alg: none" token',
      (token: string) => {
        const [, payload] = token.split('.');
        return `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`;
      },
    ],
  ])('rejects %s', async (_label, forge) => {
    const { accessToken } = (await login(owner, OWNER_PASSWORD).expect(200))
      .body as AccessTokenResponse;

    await http()
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${forge(accessToken)}`)
      .expect(401);
  });

  it('allows CORS only from the dashboard origin, with credentials', async () => {
    const allowed = await http()
      .options('/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    const other = await http()
      .options('/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Login rate limit', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({ env: { LOGIN_RATE_LIMIT_PER_MINUTE: '3' } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 429 after too many attempts in a minute', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'x@acme.test', password: 'whatever-123' });

    for (let i = 0; i < 3; i += 1) await attempt().expect(401);
    const blocked = await attempt().expect(429);
    expect(blocked.body).toMatchObject({ status: 429 });
  });
});
