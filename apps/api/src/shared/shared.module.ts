import { Global, Module } from '@nestjs/common';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';
import { Clock } from './application/ports/clock';
import { IdGenerator } from './application/ports/id-generator';
import { TransactionRunner } from './application/ports/transaction-runner';
import { CryptoIdGenerator } from './infrastructure/crypto-id-generator';
import { ClsTransactionRunner } from './infrastructure/prisma/cls-transaction-runner';
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
  ],
  exports: [Clock, IdGenerator, TransactionRunner],
})
export class SharedModule {}
