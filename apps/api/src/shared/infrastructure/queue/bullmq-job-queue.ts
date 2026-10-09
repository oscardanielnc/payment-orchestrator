import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { JobQueue, QUEUES, type QueueName } from '../../application/ports/job-queue';

@Injectable()
export class BullMqJobQueue extends JobQueue {
  private readonly queues: Record<QueueName, Queue>;

  constructor(
    @InjectQueue(QUEUES.inboundEvents) inbound: Queue,
    @InjectQueue(QUEUES.domainEvents) domain: Queue,
    @InjectQueue(QUEUES.deadLetter) deadLetter: Queue,
    @InjectQueue(QUEUES.webhookDeliveries) webhooks: Queue,
  ) {
    super();
    this.queues = {
      [QUEUES.inboundEvents]: inbound,
      [QUEUES.domainEvents]: domain,
      [QUEUES.deadLetter]: deadLetter,
      [QUEUES.webhookDeliveries]: webhooks,
    };
  }

  async enqueue(queue: QueueName, jobId: string, data: Record<string, unknown>): Promise<void> {
    // The job name is the queue's purpose; retries and backoff come from the queue defaults.
    await this.queues[queue].add(queue, data, { jobId });
  }
}
