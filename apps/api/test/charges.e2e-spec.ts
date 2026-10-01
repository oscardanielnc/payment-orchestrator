import type { INestApplication } from '@nestjs/common';
import type { Charge, ChargeList } from '@po/contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChargeRepository } from '../src/modules/charges/application/ports/charge.repository';
import { CreateOrganizationUseCase } from '../src/modules/identity/application/use-cases/create-organization.use-case';
import { ConcurrencyConflictError } from '../src/shared/domain/concurrency-conflict.error';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from './setup/create-test-app';

describe('Charges API (real Postgres)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let acme: { id: string; token: string };
  let globex: { id: string; token: string };
  let keySeq = 0;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const create = app.get(CreateOrganizationUseCase);
    const a = await create.execute({ name: 'Acme Coffee' });
    const g = await create.execute({ name: 'Globex' });
    acme = { id: a.organization.id, token: a.token };
    globex = { id: g.organization.id, token: g.token };
  });

  afterAll(async () => {
    await app.close();
  });

  const newKey = () => `test-key-${Date.now()}-${(keySeq += 1)}`;
  const post = (body: object, key: string | null, token = acme.token) => {
    const call = request(app.getHttpServer())
      .post('/v1/charges')
      .set('Authorization', `Bearer ${token}`);
    return key ? call.set('Idempotency-Key', key).send(body) : call.send(body);
  };
  const get = (path: string, token = acme.token) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
  const usdt = { amount: '10000000', currency: 'USDT', reference: 'order-4821' };

  it('creates a pending charge and its charge.created outbox event', async () => {
    const response = await post(usdt, newKey()).expect(201);
    const charge = response.body as Charge;

    expect(charge).toMatchObject({ object: 'charge', status: 'pending', amount: '10000000' });
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: charge.id } });
    expect(events.map((e) => e.type)).toEqual(['charge.created']);
  });

  it('replays the same response for a retried request: one charge only', async () => {
    const key = newKey();
    const first = await post(usdt, key).expect(201);
    const retry = await post(
      { reference: 'order-4821', currency: 'USDT', amount: '10000000' },
      key,
    );

    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.text).toBe(first.text); // byte-identical, not just equivalent JSON
    expect(
      await prisma.charge.count({
        where: { reference: 'order-4821', id: (first.body as Charge).id },
      }),
    ).toBe(1);
  });

  it('creates exactly one charge when the same request arrives twice at once', async () => {
    const key = newKey();
    const body = { amount: '777', currency: 'USD', reference: `race-${key}` };

    const [a, b] = await Promise.all([post(body, key), post(body, key)]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect((a.body as Charge).id).toBe((b.body as Charge).id);
    expect(await prisma.charge.count({ where: { reference: body.reference } })).toBe(1);
  });

  it('rejects reusing a key with a different body', async () => {
    const key = newKey();
    await post(usdt, key).expect(201);

    const response = await post({ ...usdt, amount: '1' }, key).expect(409);
    expect(response.body).toMatchObject({ code: 'idempotency.key_reused' });
  });

  it('requires an Idempotency-Key', async () => {
    const response = await post(usdt, null).expect(400);
    expect(response.body).toMatchObject({ code: 'idempotency.key_required' });
  });

  it.each([
    ['a decimal amount', { amount: '10.5', currency: 'USD' }],
    ['a JSON number', { amount: 1050, currency: 'USD' }],
    ['a zero amount', { amount: '0', currency: 'USD' }],
    ['an unknown currency', { amount: '100', currency: 'BTC' }],
    ['an unknown field', { amount: '100', currency: 'USD', tip: '5' }],
  ])('rejects %s with field errors and frees the key', async (_label, body) => {
    const key = newKey();
    const response = await post(body, key).expect(400);

    expect(response.body).toMatchObject({ code: 'validation_failed' });
    expect((response.body as { errors: unknown[] }).errors.length).toBeGreaterThan(0);
    await post(usdt, key).expect(201); // the failed attempt did not consume the key
  });

  it("returns 404 for another organization's charge", async () => {
    const charge = (await post(usdt, newKey()).expect(201)).body as Charge;

    await get(`/v1/charges/${charge.id}`).expect(200);
    const response = await get(`/v1/charges/${charge.id}`, globex.token).expect(404);
    expect(response.body).toMatchObject({ code: 'charge.not_found' });
  });

  it('lists only the caller’s charges, newest first, across pages', async () => {
    for (let i = 0; i < 3; i += 1) {
      await post({ amount: '100', currency: 'PEN' }, newKey(), globex.token).expect(201);
    }

    const page1 = (await get('/v1/charges?limit=2', globex.token).expect(200)).body as ChargeList;
    const page2 = (
      await get(`/v1/charges?limit=2&cursor=${page1.nextCursor}`, globex.token).expect(200)
    ).body as ChargeList;

    const all = [...page1.data, ...page2.data];
    expect(all).toHaveLength(3);
    expect(new Set(all.map((c) => c.id)).size).toBe(3);
    expect(page2.nextCursor).toBeNull();
    const times = all.map((c) => c.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('detects a concurrent update with optimistic locking', async () => {
    const created = (await post(usdt, newKey()).expect(201)).body as Charge;
    const repository = app.get(ChargeRepository);
    const first = await repository.findForOrganization(acme.id, created.id);
    const second = await repository.findForOrganization(acme.id, created.id);
    if (!first || !second) throw new Error('charge not found');

    first.startProcessing(new Date());
    await repository.save(first);
    second.startProcessing(new Date());

    await expect(repository.save(second)).rejects.toThrow(ConcurrencyConflictError);
  });
});
