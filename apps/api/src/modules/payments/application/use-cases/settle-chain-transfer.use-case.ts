import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { ChargePaymentsService } from '../../../charges/application/services/charge-payments.service';
import { chainTransferCodec } from '../../../crypto/application/services/chain-transfer.codec';
import { ChainTransfersService } from '../../../crypto/application/services/chain-transfers.service';
import type { ChainTransfer } from '../../../crypto/domain/chain-transfer';
import type { DepositCredit } from '../../../crypto/domain/deposit-address';
import { LedgerService } from '../../../ledger/application/services/ledger.service';
import { PaymentAttemptRepository } from '../ports/payment-attempt.repository';
import { chargeSettled, transferReceived } from '../services/payment-postings';

export interface SettleResult {
  applied: boolean;
  paid: boolean;
}

/**
 * One confirmed transfer, ONE transaction:
 *   record it → credit the deposit → ledger: tokens received
 *   if the deposit just reached the amount → charge + attempt succeeded → ledger: settled
 * Idempotent: the transfer key and the ledger external ids make a second run a no-op.
 */
@Injectable()
export class SettleChainTransferUseCase {
  private readonly logger = new Logger(SettleChainTransferUseCase.name);

  constructor(
    private readonly chain: ChainTransfersService,
    private readonly attempts: PaymentAttemptRepository,
    private readonly charges: ChargePaymentsService,
    private readonly ledger: LedgerService,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  execute(transfer: ChainTransfer): Promise<SettleResult> {
    return this.transaction.run(async () => {
      const credit = await this.chain.applyTransfer(transfer);
      if (!credit) return { applied: false, paid: false };

      await this.ledger.post(
        transferReceived({
          credit,
          network: transfer.network,
          amount: transfer.amount,
          externalId: `chain-transfer:${transfer.network}:${chainTransferCodec.externalId(transfer)}`,
        }),
      );
      const paid = credit.justFunded && (await this.settle(credit));
      return { applied: true, paid };
    });
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
