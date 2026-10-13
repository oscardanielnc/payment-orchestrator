import type { DepositBalancesService } from '../../../crypto/application/services/deposit-balances.service';
import type { CryptoNetwork } from '../../../crypto/domain/network';
import type { LedgerService } from '../../../ledger/application/services/ledger.service';
import { paymentAccounts } from '../../../payments/application/services/payment-postings';
import { ReconciliationSource } from '../../application/ports/reconciliation-ports';
import type { ReconRecord } from '../../domain/compare';
import type { ReconWindow } from '../../domain/window';

/**
 * Chain side: the token balance of every deposit address of a charge, read from the chain
 * (deposits are never swept, so balance = everything received). Ledger side: net movement
 * on `platform:<network>:deposits` for that charge. Subject = `deposits:<network>:<charge>`.
 * A transfer the watcher missed shows up here as money on-chain that the ledger lacks.
 */
export class ChainReconciliationSource extends ReconciliationSource {
  constructor(
    readonly id: CryptoNetwork,
    private readonly deposits: DepositBalancesService,
    private readonly ledger: LedgerService,
  ) {
    super();
  }

  async providerRecordsIn(window: ReconWindow): Promise<ReconRecord[]> {
    const chargeIds = await this.deposits.chargesCreatedBetween(this.id, window.from, window.to);
    return this.onChain(chargeIds);
  }

  providerRecordsFor(subjects: string[]): Promise<ReconRecord[]> {
    return this.onChain(subjects.map((s) => this.chargeOf(s)));
  }

  ledgerRecordsIn(window: ReconWindow): Promise<ReconRecord[]> {
    return this.ledgerRecords({ window });
  }

  async ledgerRecordsFor(subjects: string[]): Promise<ReconRecord[]> {
    if (subjects.length === 0) return [];
    return this.ledgerRecords({ keys: subjects.map((s) => this.chargeOf(s)) });
  }

  private async onChain(chargeIds: string[]): Promise<ReconRecord[]> {
    if (chargeIds.length === 0) return [];
    const balances = await this.deposits.onChainBalances(this.id, chargeIds);
    return balances.map((b) => ({
      subject: this.subjectOf(b.chargeId),
      organizationId: b.organizationId,
      chargeId: b.chargeId,
      currency: b.currency,
      amount: b.onChain,
    }));
  }

  private async ledgerRecords(scope: { window?: ReconWindow; keys?: string[] }) {
    const rows = await this.ledger.netDebits({
      accountCode: paymentAccounts.cryptoDeposits(this.id, '').code,
      groupBy: 'reference',
      ...scope,
    });
    return rows.map((row): ReconRecord => ({
      subject: this.subjectOf(row.key),
      organizationId: row.organizationId,
      chargeId: row.key,
      currency: row.currency,
      amount: row.netDebits,
    }));
  }

  private subjectOf(chargeId: string): string {
    return `deposits:${this.id}:${chargeId}`;
  }

  private chargeOf(subject: string): string {
    return subject.slice(this.subjectOf('').length);
  }
}
