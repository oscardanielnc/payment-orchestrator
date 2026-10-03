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
  ],
  providers: [{ provide: JobQueue, useClass: BullMqJobQueue }],
  exports: [JobQueue, BullModule],
})
export class QueueModule {}
