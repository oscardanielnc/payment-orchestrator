import type { LedgerService } from '../../../ledger/application/services/ledger.service';
import {
  paymentAccounts,
  providerPaymentExternalId,
} from '../../../payments/application/services/payment-postings';
import type {
  MercadoPagoApi,
  MercadoPagoPayment,
} from '../../../payments/infrastructure/providers/mercadopago/mercadopago-client';
import { paidAmount } from '../../../payments/infrastructure/providers/mercadopago/mercadopago.provider';
import { ReconciliationSource } from '../../application/ports/reconciliation-ports';
import type { ReconRecord } from '../../domain/compare';
import type { ReconWindow } from '../../domain/window';

const PROVIDER = 'mercadopago';
const SUBJECT_PREFIX = providerPaymentExternalId(PROVIDER, '');
const PAGE = 100;
const MAX_PAYMENTS_PER_WINDOW = 10_000;

/**
 * Mercado Pago side: approved payments that carry one of our attempt ids, summed per attempt
 * (two approved payments on one preference show up as an amount mismatch).
 * Ledger side: net movement on `platform:mercadopago:receivable` per captured payment.
 * Subject = the ledger externalId (`provider-payment:mercadopago:<attempt id>`).
 */
export class MercadoPagoReconciliationSource extends ReconciliationSource {
  readonly id = PROVIDER;

  constructor(
    private readonly api: MercadoPagoApi,
    private readonly ledger: LedgerService,
  ) {
    super();
  }

  async providerRecordsIn(window: ReconWindow): Promise<ReconRecord[]> {
    const payments: MercadoPagoPayment[] = [];
    for (let offset = 0; offset < MAX_PAYMENTS_PER_WINDOW; offset += PAGE) {
      const page = await this.api.searchPayments({
        createdFrom: window.from,
        createdTo: window.to,
        offset,
        limit: PAGE,
      });
      payments.push(...page.results);
      if (page.results.length < PAGE || offset + PAGE >= page.total) break;
    }
    return toRecords(payments);
  }

  async providerRecordsFor(subjects: string[]): Promise<ReconRecord[]> {
    const payments: MercadoPagoPayment[] = [];
    for (const subject of subjects) {
      const externalReference = subject.slice(SUBJECT_PREFIX.length);
      payments.push(...(await this.api.searchPayments({ externalReference })).results);
    }
    return toRecords(payments);
  }

  async ledgerRecordsIn(window: ReconWindow): Promise<ReconRecord[]> {
    return this.ledgerRecords({ window });
  }

  async ledgerRecordsFor(subjects: string[]): Promise<ReconRecord[]> {
    return subjects.length === 0 ? [] : this.ledgerRecords({ keys: subjects });
  }

  private async ledgerRecords(scope: { window?: ReconWindow; keys?: string[] }) {
    const rows = await this.ledger.netDebits({
      accountCode: paymentAccounts.providerReceivable(PROVIDER, 'PEN').code,
      groupBy: 'externalId',
      ...scope,
    });
    return rows.map((row): ReconRecord => ({
      subject: row.key,
      organizationId: row.organizationId,
      chargeId: row.reference,
      currency: row.currency,
      amount: row.netDebits,
    }));
  }
}

/** Only approved payments we created (they carry our attempt id), summed per attempt. */
function toRecords(payments: MercadoPagoPayment[]): ReconRecord[] {
  const bySubject = new Map<string, ReconRecord>();
  for (const payment of payments) {
    if (payment.status !== 'approved' || !payment.external_reference) continue;
    const subject = providerPaymentExternalId(PROVIDER, payment.external_reference);
    const amount = paidAmount(payment).amount;
    const metadata = (payment.metadata ?? {}) as Record<string, string | undefined>;
    const existing = bySubject.get(subject);
    bySubject.set(subject, {
      subject,
      organizationId: existing?.organizationId ?? metadata.organization_id ?? null,
      chargeId: existing?.chargeId ?? metadata.charge_id ?? null,
      currency: payment.currency_id,
      amount: (existing?.amount ?? 0n) + amount,
    });
  }
  return [...bySubject.values()];
}
