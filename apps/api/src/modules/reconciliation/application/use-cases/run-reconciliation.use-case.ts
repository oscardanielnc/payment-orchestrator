import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { compareRecords, type ReconRecord } from '../../domain/compare';
import { UnknownReconciliationSourceError } from '../../domain/errors';
import { Finding } from '../../domain/finding';
import type { ReconWindow } from '../../domain/window';
import {
  FindingRepository,
  ReconciliationRunRepository,
  ReconciliationSources,
} from '../ports/reconciliation-ports';

export interface ReconciliationSummary {
  source: string;
  matched: number;
  discrepancies: number;
  /** Findings opened for the first time in this run. */
  opened: number;
}

/**
 * Compares one source with the ledger over a window and stores the differences as findings
 * (ADR 0021). Reads happen outside the transaction; only the findings and the run row are
 * written, together. Never posts to the ledger. Running it twice gives the same findings.
 */
@Injectable()
export class RunReconciliationUseCase {
  constructor(
    private readonly sources: ReconciliationSources,
    private readonly findings: FindingRepository,
    private readonly runs: ReconciliationRunRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(input: { source: string; window: ReconWindow }): Promise<ReconciliationSummary> {
    const source = this.sources.find(input.source);
    if (!source) throw new UnknownReconciliationSourceError(input.source);

    const [providerIn, ledgerIn] = await Promise.all([
      source.providerRecordsIn(input.window),
      source.ledgerRecordsIn(input.window),
    ]);
    const [providerRest, ledgerRest] = await Promise.all([
      source.providerRecordsFor(missingFrom(providerIn, ledgerIn)),
      source.ledgerRecordsFor(missingFrom(ledgerIn, providerIn)),
    ]);
    const { matched, discrepancies } = compareRecords(
      [...providerIn, ...providerRest],
      [...ledgerIn, ...ledgerRest],
    );

    const now = this.clock.now();
    let opened = 0;
    await this.transaction.run(async () => {
      const subjects = [...matched, ...discrepancies.map((d) => d.subject)];
      const known = new Map(
        (await this.findings.findBySubjects(source.id, subjects)).map((f) => [f.subject, f]),
      );
      for (const discrepancy of discrepancies) {
        const existing = known.get(discrepancy.subject);
        if (existing) {
          existing.observe(discrepancy, now);
          await this.findings.save(existing);
        } else {
          opened += 1;
          await this.findings.save(
            Finding.open({ id: this.ids.uuid(), source: source.id, discrepancy, now }),
          );
        }
      }
      for (const subject of matched) {
        const existing = known.get(subject);
        if (existing?.status === 'open') {
          existing.clear(now);
          await this.findings.save(existing);
        }
      }
      await this.runs.save({
        source: source.id,
        window: input.window,
        matched: matched.length,
        discrepancies: discrepancies.length,
        ranAt: now,
      });
    });

    return {
      source: source.id,
      matched: matched.length,
      discrepancies: discrepancies.length,
      opened,
    };
  }
}

/** Subjects the other side mentioned that this side has not read yet. */
function missingFrom(side: ReconRecord[], other: ReconRecord[]): string[] {
  const seen = new Set(side.map((r) => r.subject));
  return [...new Set(other.map((r) => r.subject))].filter((s) => !seen.has(s));
}
