import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ReconcilePreviousDayUseCase } from '../modules/reconciliation/application/use-cases/reconcile-previous-day.use-case';

const CHECK_EVERY_MS = 60 * 60_000;
/** Lets the worker settle in (and keeps short-lived test workers from reconciling). */
const FIRST_CHECK_AFTER_MS = 5 * 60_000;

/**
 * Daily reconciliation (feature 15): every hour, yesterday's window is reconciled for each
 * source that has no run yet. Hourly instead of a fixed time: a worker that was down at
 * midnight still catches up, and a failed source is retried.
 */
@Injectable()
export class ReconciliationSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ReconciliationSchedulerService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly reconcile: ReconcilePreviousDayUseCase) {}

  onApplicationBootstrap(): void {
    this.timer = setTimeout(() => {
      void this.check();
      this.timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
    }, FIRST_CHECK_AFTER_MS);
  }

  onApplicationShutdown(): void {
    clearTimeout(this.timer);
    clearInterval(this.timer);
  }

  private async check(): Promise<void> {
    try {
      for (const run of await this.reconcile.execute()) {
        this.logger.log(
          `${run.source}: ${run.matched} matched, ${run.discrepancies} finding(s), ${run.opened} new`,
        );
      }
    } catch (error) {
      this.logger.error('Reconciliation check failed', error as Error);
    }
  }
}
