import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  ImmediateTransactionRunner,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import type { ReconRecord } from '../../domain/compare';
import { FindingNotFoundError } from '../../domain/errors';
import type { Finding, FindingStatus } from '../../domain/finding';
import type { ReconWindow } from '../../domain/window';
import {
  type FindingPosition,
  FindingRepository,
  type ReconciliationRun,
  ReconciliationRunRepository,
  ReconciliationSource,
  ReconciliationSources,
} from '../ports/reconciliation-ports';
import { ReconcilePreviousDayUseCase } from './reconcile-previous-day.use-case';
import { ResolveFindingUseCase } from './resolve-finding.use-case';
import { RunReconciliationUseCase } from './run-reconciliation.use-case';

const rec = (subject: string, amount: bigint): ReconRecord => ({
  subject,
  organizationId: 'org-1',
  chargeId: null,
  currency: 'USD',
  amount,
});

/** Each side split into "seen in the window" and "only found when looked up". */
class ScriptedSource extends ReconciliationSource {
  readonly id = 'stripe';
  providerIn: ReconRecord[] = [];
  providerElsewhere: ReconRecord[] = [];
  ledgerIn: ReconRecord[] = [];
  ledgerElsewhere: ReconRecord[] = [];
  lookups: { provider: string[]; ledger: string[] } = { provider: [], ledger: [] };

  providerRecordsIn() {
    return Promise.resolve(this.providerIn);
  }
  providerRecordsFor(subjects: string[]) {
    this.lookups.provider.push(...subjects);
    return Promise.resolve(this.providerElsewhere.filter((r) => subjects.includes(r.subject)));
  }
  ledgerRecordsIn() {
    return Promise.resolve(this.ledgerIn);
  }
  ledgerRecordsFor(subjects: string[]) {
    this.lookups.ledger.push(...subjects);
    return Promise.resolve(this.ledgerElsewhere.filter((r) => subjects.includes(r.subject)));
  }
}

class InMemoryFindings extends FindingRepository {
  readonly rows = new Map<string, Finding>();

  save(finding: Finding) {
    finding.markPersisted(finding.version + 1);
    this.rows.set(finding.id, finding);
    return Promise.resolve();
  }
  findBySubjects(source: string, subjects: string[]) {
    return Promise.resolve(
      [...this.rows.values()].filter((f) => f.source === source && subjects.includes(f.subject)),
    );
  }
  findForOrganization(organizationId: string, id: string) {
    const finding = this.rows.get(id);
    return Promise.resolve(finding?.organizationId === organizationId ? finding : null);
  }
  listForOrganization(query: { status: FindingStatus | undefined; after: FindingPosition | null }) {
    const items = [...this.rows.values()].filter((f) => !query.status || f.status === query.status);
    return Promise.resolve({ items, next: null });
  }
}

class InMemoryRuns extends ReconciliationRunRepository {
  readonly saved: ReconciliationRun[] = [];

  save(run: ReconciliationRun) {
    this.saved.push(run);
    return Promise.resolve();
  }
  exists(source: string, window: ReconWindow) {
    return Promise.resolve(
      this.saved.some(
        (r) => r.source === source && r.window.from.getTime() === window.from.getTime(),
      ),
    );
  }
}

class Sources extends ReconciliationSources {
  constructor(private readonly sources: ReconciliationSource[]) {
    super();
  }
  all() {
    return this.sources;
  }
  find(id: string) {
    return this.sources.find((s) => s.id === id);
  }
}

const window: ReconWindow = {
  from: new Date('2026-10-12T00:00:00Z'),
  to: new Date('2026-10-13T00:00:00Z'),
};

function setup() {
  const source = new ScriptedSource();
  const findings = new InMemoryFindings();
  const runs = new InMemoryRuns();
  const clock = new FixedClock(new Date('2026-10-13T01:00:00Z'));
  const run = new RunReconciliationUseCase(
    new Sources([source]),
    findings,
    runs,
    new SequentialIdGenerator(),
    clock,
    new ImmediateTransactionRunner(),
  );
  return { source, findings, runs, clock, run };
}

describe('RunReconciliationUseCase', () => {
  it('looks up on the other side what one side saw, so day boundaries do not create findings', async () => {
    const { source, findings, run } = setup();
    // Created at Stripe on the 12th, recorded in the ledger just after midnight.
    source.providerIn = [rec('pi_late', 500n)];
    source.ledgerElsewhere = [rec('pi_late', 500n)];

    expect(await run.execute({ source: 'stripe', window })).toMatchObject({
      matched: 1,
      discrepancies: 0,
    });
    expect(source.lookups.ledger).toEqual(['pi_late']);
    expect(findings.rows.size).toBe(0);
  });

  it('stores one finding per difference and gives the same result when run twice', async () => {
    const { source, findings, runs, run } = setup();
    source.providerIn = [rec('pi_lost_webhook', 500n), rec('pi_ok', 100n)];
    source.ledgerIn = [rec('pi_ok', 100n), rec('pi_ghost', 300n)];

    const first = await run.execute({ source: 'stripe', window });
    const second = await run.execute({ source: 'stripe', window });

    expect(first).toEqual({ source: 'stripe', matched: 1, discrepancies: 2, opened: 2 });
    expect(second).toEqual({ ...first, opened: 0 });
    expect([...findings.rows.values()].map((f) => `${f.subject} ${f.kind}`).sort()).toEqual([
      'pi_ghost missing_at_provider',
      'pi_lost_webhook missing_in_ledger',
    ]);
    expect(runs.saved).toHaveLength(2);
  });

  it('clears an open finding once both sides agree (the late webhook arrived)', async () => {
    const { source, findings, run } = setup();
    source.providerIn = [rec('pi_1', 500n)];
    await run.execute({ source: 'stripe', window });

    source.ledgerIn = [rec('pi_1', 500n)];
    await run.execute({ source: 'stripe', window });

    expect([...findings.rows.values()][0]?.status).toBe('cleared');
  });
});

describe('ReconcilePreviousDayUseCase', () => {
  it('reconciles yesterday once per source', async () => {
    const { source, runs, clock, run } = setup();
    source.providerIn = [rec('pi_1', 500n)];
    const daily = new ReconcilePreviousDayUseCase(new Sources([source]), runs, run, clock);

    expect(await daily.execute()).toHaveLength(1);
    expect(await daily.execute()).toHaveLength(0);
    expect(runs.saved[0]?.window).toEqual(window);
  });
});

describe('ResolveFindingUseCase', () => {
  it('lets a person resolve a finding of their own organization only', async () => {
    const { source, findings, clock, run } = setup();
    source.providerIn = [rec('pi_1', 500n)];
    await run.execute({ source: 'stripe', window });
    const [finding] = [...findings.rows.values()];
    const resolve = new ResolveFindingUseCase(findings, clock, new ImmediateTransactionRunner());

    await expect(
      resolve.execute({ organizationId: 'org-2', findingId: finding!.id, userId: 'u', note: null }),
    ).rejects.toThrow(FindingNotFoundError);
    const resolved = await resolve.execute({
      organizationId: 'org-1',
      findingId: finding!.id,
      userId: 'user-1',
      note: 'Customer refunded',
    });
    expect(resolved).toMatchObject({ status: 'resolved', note: 'Customer refunded' });
  });
});
