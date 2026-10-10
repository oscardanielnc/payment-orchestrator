import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SyncProviderPaymentsUseCase } from '../modules/payments/application/use-cases/sync-provider-payments.use-case';

const SWEEP_EVERY_MS = 60_000;

/**
 * Every minute, asks providers about card payments whose webhook is late (ADR 0019).
 * A lost webhook then delays a payment by minutes instead of leaving it stuck.
 */
@Injectable()
export class ProviderPaymentSyncService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProviderPaymentSyncService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly syncPayments: SyncProviderPaymentsUseCase) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    try {
      const settled = await this.syncPayments.execute();
      if (settled > 0) this.logger.log(`Settled ${settled} payment(s) by status check`);
    } catch (error) {
      this.logger.error('Provider payment sync failed', error as Error);
    }
  }
}
