import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import {
  LedgerAccountRepository,
  LedgerActivityReader,
  LedgerBalanceReader,
  LedgerTransactionRepository,
} from './application/ports/ledger-repositories';
import { LedgerService } from './application/services/ledger.service';
import {
  PrismaLedgerAccountRepository,
  PrismaLedgerActivityReader,
  PrismaLedgerBalanceReader,
  PrismaLedgerTransactionRepository,
} from './infrastructure/persistence/prisma/prisma-ledger.repositories';
import { LedgerController } from './presentation/http/ledger.controller';

@Module({
  imports: [IdentityModule],
  controllers: [LedgerController],
  providers: [
    { provide: LedgerAccountRepository, useClass: PrismaLedgerAccountRepository },
    { provide: LedgerTransactionRepository, useClass: PrismaLedgerTransactionRepository },
    { provide: LedgerBalanceReader, useClass: PrismaLedgerBalanceReader },
    { provide: LedgerActivityReader, useClass: PrismaLedgerActivityReader },
    LedgerService,
  ],
  // Public API: other modules post through LedgerService, never the repositories.
  exports: [LedgerService],
})
export class LedgerModule {}
