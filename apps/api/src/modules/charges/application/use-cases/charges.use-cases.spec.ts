import { beforeEach, describe, expect, it } from 'vitest';
import { UnsupportedCurrencyError } from '../../../../shared/domain/money';
import {
  FixedClock,
  ImmediateTransactionRunner,
  InMemoryOutbox,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { Charge } from '../../domain/charge';
import { ChargeNotFoundError, InvalidChargeCursorError } from '../../domain/errors';
import { ChargePage, ChargePosition, ChargeRepository } from '../ports/charge.repository';
import { CreateChargeUseCase, DEFAULT_EXPIRY_SECONDS } from './create-charge.use-case';
import { ExpireChargesUseCase } from './expire-charges.use-case';
import { GetChargeByCheckoutTokenUseCase } from './get-charge-by-checkout-token.use-case';
import { GetChargeUseCase } from './get-charge.use-case';
import { ListChargesUseCase } from './list-charges.use-case';

class InMemoryChargeRepository extends ChargeRepository {
  readonly rows: Charge[] = [];

  save(charge: Charge): Promise<void> {
    if (!this.rows.includes(charge)) this.rows.push(charge);
    charge.markPersisted(charge.version + 1);
    return Promise.resolve();
  }

  findForOrganization(organizationId: string, id: string): Promise<Charge | null> {
    return Promise.resolve(
      this.rows.find((c) => c.id === id && c.organizationId === organizationId) ?? null,
    );
  }

  findByCheckoutToken(token: string): Promise<Charge | null> {
    return Promise.resolve(this.rows.find((c) => c.checkoutToken === token) ?? null);
  }

  findPendingExpiredAt(now: Date, limit: number): Promise<Charge[]> {
    return Promise.resolve(
      this.rows.filter((c) => c.status === 'pending' && c.isExpiredAt(now)).slice(0, limit),
    );
  }

  listForOrganization(
    organizationId: string,
    page: { limit: number; after: ChargePosition | null; status?: string },
  ): Promise<ChargePage> {
    const sorted = this.rows
      .filter(
        (c) => c.organizationId === organizationId && (!page.status || c.status === page.status),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    const start = page.after ? sorted.findIndex((c) => c.id === page.after?.id) + 1 : 0;
    const items = sorted.slice(start, start + page.limit);
    const last = items.at(-1);
    const hasMore = start + page.limit < sorted.length;
    return Promise.resolve({
      items,
      next: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
    });
  }
}

describe('charges use cases', () => {
  let charges: InMemoryChargeRepository;
  let outbox: InMemoryOutbox;
  let clock: FixedClock;
  let create: CreateChargeUseCase;

  beforeEach(() => {
    charges = new InMemoryChargeRepository();
    outbox = new InMemoryOutbox();
    clock = new FixedClock();
    create = new CreateChargeUseCase(
      charges,
      outbox,
      new SequentialIdGenerator(),
      clock,
      new ImmediateTransactionRunner(),
    );
  });

  const createAt = async (minute: number, organizationId = 'org-1') => {
    clock.current = new Date(Date.UTC(2026, 9, 1, 12, minute));
    return create.execute({ organizationId, amount: '10000000', currency: 'USDT' });
  };

  it('creates a pending charge with the default expiry and a charge.created event', async () => {
    const charge = await create.execute({
      organizationId: 'org-1',
      amount: '2500',
      currency: 'USD',
      reference: 'order-4821',
    });

    expect(charge.status).toBe('pending');
    expect(charge.amount.toMinorUnits()).toBe('2500');
    expect(charge.expiresAt.getTime() - charge.createdAt.getTime()).toBe(
      DEFAULT_EXPIRY_SECONDS * 1000,
    );
    expect(outbox.events).toEqual([
      expect.objectContaining({ type: 'charge.created', aggregateId: charge.id }),
    ]);
  });

  it('gives every charge its own checkout token and finds it by that token only', async () => {
    const first = await createAt(0);
    const second = await createAt(1);
    const byToken = new GetChargeByCheckoutTokenUseCase(charges);

    expect(first.checkoutToken).not.toBe(second.checkoutToken);
    await expect(byToken.execute(second.checkoutToken)).resolves.toBe(second);
    await expect(byToken.execute(second.id)).rejects.toThrow(ChargeNotFoundError);
  });

  it('expires pending charges past their expiry and leaves the rest alone', async () => {
    const stale = await createAt(0);
    const paying = await createAt(1);
    const fresh = await createAt(50);
    paying.beginPaymentAttempt(new Date(Date.UTC(2026, 9, 1, 12, 2)));
    outbox.events.length = 0;
    clock.current = new Date(stale.expiresAt.getTime() + 60_000);

    const expired = await new ExpireChargesUseCase(
      charges,
      outbox,
      clock,
      new ImmediateTransactionRunner(),
    ).execute();

    expect(expired).toBe(1);
    expect([stale.status, paying.status, fresh.status]).toEqual([
      'expired',
      'processing',
      'pending',
    ]);
    expect(outbox.events.map((e) => e.type)).toEqual(['charge.expired']);
  });

  it('rejects an unsupported currency before touching storage', async () => {
    await expect(
      create.execute({ organizationId: 'org-1', amount: '1', currency: 'BTC' }),
    ).rejects.toThrow(UnsupportedCurrencyError);
    expect(charges.rows).toHaveLength(0);
  });

  it("hides another organization's charge", async () => {
    const charge = await createAt(0, 'org-1');

    await expect(
      new GetChargeUseCase(charges).execute({ organizationId: 'org-2', chargeId: charge.id }),
    ).rejects.toThrow(ChargeNotFoundError);
  });

  it('pages newest first with an opaque cursor until the end', async () => {
    const created = [];
    for (let minute = 0; minute < 5; minute += 1) created.push(await createAt(minute));
    const list = new ListChargesUseCase(charges);

    const first = await list.execute({ organizationId: 'org-1', limit: 2 });
    const second = await list.execute({
      organizationId: 'org-1',
      limit: 2,
      cursor: first.nextCursor ?? '',
    });
    const third = await list.execute({
      organizationId: 'org-1',
      limit: 2,
      cursor: second.nextCursor ?? '',
    });

    const ids = [...first.items, ...second.items, ...third.items].map((c) => c.id);
    expect(ids).toEqual(created.reverse().map((c) => c.id));
    expect(third.nextCursor).toBeNull();
  });

  it('rejects a tampered cursor', async () => {
    await expect(
      new ListChargesUseCase(charges).execute({ organizationId: 'org-1', limit: 2, cursor: 'xx' }),
    ).rejects.toThrow(InvalidChargeCursorError);
  });
});
