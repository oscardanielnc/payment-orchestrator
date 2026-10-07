import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ExpireChargesUseCase } from '../modules/charges/application/use-cases/expire-charges.use-case';

const SWEEP_EVERY_MS = 60_000;

/**
 * Every minute, pending charges past their expiry become `expired` (and emit
 * `charge.expired`). The checkout already shows them as expired from the expiry time;
 * this makes the stored status, the dashboard and future webhooks agree.
 */
@Injectable()
export class ChargeExpiryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ChargeExpiryService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly expireCharges: ExpireChargesUseCase) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    try {
      const expired = await this.expireCharges.execute();
      if (expired > 0) this.logger.log(`Expired ${expired} charge(s)`);
    } catch (error) {
      this.logger.error('Charge expiry sweep failed', error as Error);
    }
  }
}
