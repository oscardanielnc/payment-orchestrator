import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InboundEventsService } from '../modules/inbound/application/services/inbound-events.service';

const SWEEP_EVERY_MS = 30_000;
const STALE_AFTER_MS = 60_000;

/**
 * Safety net for "stored but never queued" (Redis was down at the wrong moment, the process
 * died between commit and enqueue): every 30 s, events still `received` after a minute are
 * enqueued again. Duplicate enqueues are harmless (same jobId).
 */
@Injectable()
export class InboundRequeueService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(InboundRequeueService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly inbound: InboundEventsService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    try {
      const requeued = await this.inbound.requeueStale(STALE_AFTER_MS);
      if (requeued > 0) this.logger.warn(`Re-queued ${requeued} stale inbound event(s)`);
    } catch (error) {
      this.logger.error('Inbound requeue sweep failed', error as Error);
    }
  }
}
