import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { ChargePaymentsService } from '../../../charges/application/services/charge-payments.service';
import { ChainTransfersService } from '../../../crypto/application/services/chain-transfers.service';
import type { ChainTransfer } from '../../../crypto/domain/chain-transfer';
import type { DepositCredit } from '../../../crypto/domain/deposit-address';
import type { CryptoNetwork } from '../../../crypto/domain/network';
import { LedgerService } from '../../../ledger/application/services/ledger.service';
import { PaymentAttemptRepository } from '../ports/payment-attempt.repository';
import { chargeSettled, transferReceived } from '../services/payment-postings';

export interface ProcessSummary {
  relevant: number;
  applied: number;
  paid: number;
}

/**
 * One watcher tick for a network:
 *   1. read new confirmed transfers to our addresses (network I/O, no transaction)
 *   2. per transfer, ONE transaction:
 *        record it → credit the deposit → ledger: tokens received
 *        if the deposit just reached the amount → charge + attempt succeeded → ledger: settled
 *   3. save the cursor
 * A crash anywhere is safe: transfers are deduplicated by (txHash, eventIndex) and ledger
 * transactions by their external id.
 */
@Injectable()
export class ProcessChainTransfersUseCase {
  private readonly logger = new Logger(ProcessChainTransfersUseCase.name);

  constructor(
    private readonly chain: ChainTransfersService,
    private readonly attempts: PaymentAttemptRepository,
    private readonly charges: ChargePaymentsService,
    private readonly ledger: LedgerService,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(network: CryptoNetwork): Promise<ProcessSummary> {
    const { transfers, cursor } = await this.chain.fetchRelevant(network);
    const summary: ProcessSummary = { relevant: transfers.length, applied: 0, paid: 0 };

    for (const transfer of transfers) {
      await this.transaction.run(async () => {
        const credit = await this.chain.applyTransfer(transfer);
        if (!credit) return; // already applied in an earlier tick
        summary.applied += 1;
        await this.ledger.post(
          transferReceived({
            credit,
            network,
            amount: transfer.amount,
            externalId: transferKey(transfer),
          }),
        );
        if (credit.justFunded && (await this.settle(credit))) summary.paid += 1;
      });
    }

    await this.chain.commitCursor(network, cursor);
    return summary;
  }

  private async settle(credit: DepositCredit): Promise<boolean> {
    const paid = await this.charges.markPaid(credit.organizationId, credit.chargeId);
    if (!paid) {
      // Money arrived but the charge can no longer succeed (expired, already paid by another
      // attempt...). It stays in the merchant's `awaiting` account for reconciliation (feature 15).
      this.logger.warn(
        `Late or extra payment for charge ${credit.chargeId}; left for reconciliation`,
      );
      return false;
    }
    const attempt = await this.attempts.findById(credit.attemptId);
    if (!attempt) throw new Error(`Deposit points to missing attempt ${credit.attemptId}`);
    attempt.markSucceeded(this.clock.now());
    await this.attempts.save(attempt);
    await this.ledger.post(chargeSettled(credit));
    return true;
  }
}

const transferKey = (t: ChainTransfer) => `chain-transfer:${t.network}:${t.txHash}:${t.eventIndex}`;
