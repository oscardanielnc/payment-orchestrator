import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { JobQueue, QUEUES } from '../../application/ports/job-queue';
import { BullMqJobQueue } from './bullmq-job-queue';

/**
 * Producers only: the API and the worker can enqueue. Consumers (@Processor) are registered
 * by the worker alone, so the HTTP process never runs background jobs (ADR 0003).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: { url: config.redisUrl },
        prefix: config.queue.prefix,
        defaultJobOptions: {
          attempts: config.queue.maxAttempts,
          backoff: { type: 'exponential', delay: config.queue.backoffMs },
          removeOnComplete: 1000,
          // Failed jobs stay in Redis: they are the evidence when something breaks.
          removeOnFail: false,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.inboundEvents },
      { name: QUEUES.domainEvents },
      { name: QUEUES.deadLetter },
    ),
    // Merchant endpoints can be down for a while: longer backoff than internal jobs
    // (defaults 8 attempts from 30 s: 30 s, 1, 2, 4, 8, 16, 32 min ≈ 1 h of retries).
    BullModule.registerQueueAsync({
      name: QUEUES.webhookDeliveries,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        defaultJobOptions: {
          attempts: config.webhooks.maxAttempts,
          backoff: { type: 'exponential', delay: config.webhooks.backoffMs },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      }),
    }),
  ],
  providers: [{ provide: JobQueue, useClass: BullMqJobQueue }],
  exports: [JobQueue, BullModule],
})
export class QueueModule {}
