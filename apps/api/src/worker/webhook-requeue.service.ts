import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { RequeueLostDeliveriesUseCase } from '../modules/notifications/application/use-cases/requeue-lost-deliveries.use-case';

const SWEEP_EVERY_MS = 60_000;
const LOST_AFTER_MS = 60_000;

/** Every minute: deliveries stored over a minute ago and never tried are enqueued again. */
@Injectable()
export class WebhookRequeueService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WebhookRequeueService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly requeue: RequeueLostDeliveriesUseCase) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    try {
      const requeued = await this.requeue.execute(LOST_AFTER_MS);
      if (requeued > 0) this.logger.warn(`Re-queued ${requeued} webhook delivery(ies)`);
    } catch (error) {
      this.logger.error('Webhook requeue sweep failed', error as Error);
    }
  }
}
