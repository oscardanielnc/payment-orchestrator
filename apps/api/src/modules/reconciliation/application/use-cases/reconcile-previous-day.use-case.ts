import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { previousUtcDay } from '../../domain/window';
import { ReconciliationRunRepository, ReconciliationSources } from '../ports/reconciliation-ports';
import {
  RunReconciliationUseCase,
  type ReconciliationSummary,
} from './run-reconciliation.use-case';

/**
 * The daily job: reconciles yesterday (UTC) for every enabled source that has not been
 * reconciled yet. Safe to call every hour: a done window is skipped, a failed one retried.
 */
@Injectable()
export class ReconcilePreviousDayUseCase {
  private readonly logger = new Logger(ReconcilePreviousDayUseCase.name);

  constructor(
    private readonly sources: ReconciliationSources,
    private readonly runs: ReconciliationRunRepository,
    private readonly run: RunReconciliationUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<ReconciliationSummary[]> {
    const window = previousUtcDay(this.clock.now());
    const summaries: ReconciliationSummary[] = [];
    for (const source of this.sources.all()) {
      if (await this.runs.exists(source.id, window)) continue;
      try {
        summaries.push(await this.run.execute({ source: source.id, window }));
      } catch (error) {
        this.logger.error(
          `Reconciliation of ${source.id} failed; retried next hour`,
          error as Error,
        );
      }
    }
    return summaries;
  }
}
