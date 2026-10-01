import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { TransactionRunner } from '../../application/ports/transaction-runner';
import type { PrismaTransactionHost } from './transaction-host';

@Injectable()
export class ClsTransactionRunner extends TransactionRunner {
  constructor(
    private readonly txHost: TransactionHost,
    private readonly cls: ClsService,
  ) {
    super();
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    const host = this.txHost as PrismaTransactionHost;
    // HTTP requests already have a CLS context; CLI scripts and jobs need one opened here.
    if (this.cls.isActive()) return host.withTransaction(work);
    return this.cls.run(() => host.withTransaction(work));
  }
}
