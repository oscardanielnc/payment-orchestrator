import { Global, Module } from '@nestjs/common';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';
import { Clock } from './application/ports/clock';
import { IdempotencyStore } from './application/ports/idempotency-store';
import { IdGenerator } from './application/ports/id-generator';
import { Outbox } from './application/ports/outbox';
import { TransactionRunner } from './application/ports/transaction-runner';
import { CryptoIdGenerator } from './infrastructure/crypto-id-generator';
import { ClsTransactionRunner } from './infrastructure/prisma/cls-transaction-runner';
import { PrismaIdempotencyStore } from './infrastructure/prisma/prisma-idempotency.store';
import { PrismaOutbox } from './infrastructure/prisma/prisma-outbox';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { SystemClock } from './infrastructure/system-clock';

@Global()
@Module({
  imports: [
    PrismaModule,
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService }),
        }),
      ],
    }),
  ],
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: CryptoIdGenerator },
    { provide: TransactionRunner, useClass: ClsTransactionRunner },
    { provide: Outbox, useClass: PrismaOutbox },
    { provide: IdempotencyStore, useClass: PrismaIdempotencyStore },
  ],
  exports: [Clock, IdGenerator, TransactionRunner, Outbox, IdempotencyStore],
})
export class SharedModule {}
