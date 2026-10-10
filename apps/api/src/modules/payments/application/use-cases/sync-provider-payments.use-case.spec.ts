import { describe, expect, it } from 'vitest';
import { Money } from '../../../../shared/domain/money';
import { FixedClock } from '../../../../shared/testing/fakes';
import { PaymentAttempt } from '../../domain/payment-attempt';
import type { ProviderId } from '../../domain/payment-route';
import type { ProviderOutcome } from '../../domain/provider-outcome';
import { FakeCardProvider, FakeTronProvider } from '../../testing/fake-providers';
import type { PaymentAttemptRepository } from '../ports/payment-attempt.repository';
import type { PaymentProvider } from '../ports/payment-provider';
import { PaymentProviderRegistry } from '../ports/payment-provider-registry';
import type { SettleProviderPaymentUseCase } from './settle-provider-payment.use-case';
import {
  SYNC_AFTER_MS,
  SYNC_WINDOW_MS,
  SyncProviderPaymentsUseCase,
} from './sync-provider-payments.use-case';

const clock = new FixedClock();

const attempt = (ref: string, provider: ProviderId = 'stripe') =>
  PaymentAttempt.restore({
    id: `00000000-0000-4000-8000-${ref.padStart(12, '0')}`,
    chargeId: '00000000-0000-4000-8000-0000000000c1',
    organizationId: '00000000-0000-4000-8000-0000000000a1',
    method: 'card',
    provider,
    status: 'pending',
    externalReference: ref,
    instructions: { type: 'card_client_secret', clientSecret: `${ref}_secret` },
    failureReason: null,
    createdAt: clock.now(),
    updatedAt: clock.now(),
    version: 1,
  });

class StaticRegistry extends PaymentProviderRegistry {
  constructor(private readonly providers: PaymentProvider[]) {
    super();
  }
  find(id: ProviderId) {
    return this.providers.find((p) => p.id === id);
  }
  all() {
    return this.providers;
  }
}

/** A card provider whose payments have the outcomes in `outcomes` (missing: still open). */
class CheckableCardProvider extends FakeCardProvider {
  constructor(private readonly outcomes: Record<string, ProviderOutcome | Error>) {
    super();
  }
  fetchOutcome(ref: string): Promise<ProviderOutcome | null> {
    const outcome = this.outcomes[ref];
    if (outcome instanceof Error) return Promise.reject(outcome);
    return Promise.resolve(outcome ?? null);
  }
}

function setup(stale: PaymentAttempt[], providers: PaymentProvider[]) {
  const queries: Parameters<PaymentAttemptRepository['findPendingToSync']>[0][] = [];
  const attempts = {
    findPendingToSync: (query: (typeof queries)[number]) => {
      queries.push(query);
      return Promise.resolve(stale);
    },
  } as unknown as PaymentAttemptRepository;
  const settled: { externalReference: string; outcome: ProviderOutcome }[] = [];
  const settle = {
    execute: (input: { externalReference: string; outcome: ProviderOutcome }) => {
      settled.push(input);
      return Promise.resolve(input.outcome.kind === 'succeeded' ? 'paid' : 'failed');
    },
  } as unknown as SettleProviderPaymentUseCase;
  const useCase = new SyncProviderPaymentsUseCase(
    attempts,
    new StaticRegistry(providers),
    settle,
    clock,
  );
  return { useCase, queries, settled };
}

describe('SyncProviderPaymentsUseCase', () => {
  it('settles attempts the provider reports as final and skips the ones still open', async () => {
    const paid: ProviderOutcome = { kind: 'succeeded', amount: Money.of(500n, 'USD') };
    const { useCase, settled } = setup(
      [attempt('pi_paid'), attempt('pi_open'), attempt('pi_canceled')],
      [new CheckableCardProvider({ pi_paid: paid, pi_canceled: { kind: 'canceled' } })],
    );

    expect(await useCase.execute()).toBe(2);
    expect(settled.map((s) => `${s.externalReference} ${s.outcome.kind}`)).toEqual([
      'pi_paid succeeded',
      'pi_canceled canceled',
    ]);
  });

  it('only asks about checkable providers, quiet for a while, within the window', async () => {
    const { useCase, queries } = setup([], [new CheckableCardProvider({}), new FakeTronProvider()]);

    await useCase.execute();

    const now = clock.now().getTime();
    expect(queries).toEqual([
      {
        providers: ['stripe'],
        createdAfter: new Date(now - SYNC_WINDOW_MS),
        updatedBefore: new Date(now - SYNC_AFTER_MS),
        limit: 50,
      },
    ]);
  });

  it('keeps going when one status check fails', async () => {
    const { useCase, settled } = setup(
      [attempt('pi_broken'), attempt('pi_canceled')],
      [
        new CheckableCardProvider({
          pi_broken: new Error('timeout'),
          pi_canceled: { kind: 'canceled' },
        }),
      ],
    );

    expect(await useCase.execute()).toBe(1);
    expect(settled.map((s) => s.externalReference)).toEqual(['pi_canceled']);
  });

  it('does nothing when no enabled provider supports status checks', async () => {
    const { useCase, queries } = setup([], [new FakeTronProvider()]);

    expect(await useCase.execute()).toBe(0);
    expect(queries).toEqual([]);
  });
});
