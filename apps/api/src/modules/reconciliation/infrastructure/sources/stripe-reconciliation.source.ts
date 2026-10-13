import type { LedgerService } from '../../../ledger/application/services/ledger.service';
import {
  paymentAccounts,
  providerPaymentExternalId,
} from '../../../payments/application/services/payment-postings';
import type {
  StripeIntentSummary,
  StripePaymentIntentsApi,
} from '../../../payments/infrastructure/providers/stripe/stripe-client';
import { ReconciliationSource } from '../../application/ports/reconciliation-ports';
import type { ReconRecord } from '../../domain/compare';
import type { ReconWindow } from '../../domain/window';

const PROVIDER = 'stripe';
const SUBJECT_PREFIX = providerPaymentExternalId(PROVIDER, '');
const MAX_INTENTS_PER_WINDOW = 10_000;

/**
 * Stripe side: succeeded PaymentIntents that we created (they carry our attempt id).
 * Ledger side: net movement on `platform:stripe:receivable` per captured payment.
 * Subject = the ledger externalId, so both sides name a payment the same way.
 */
export class StripeReconciliationSource extends ReconciliationSource {
  readonly id = PROVIDER;

  constructor(
    private readonly stripe: StripePaymentIntentsApi,
    private readonly ledger: LedgerService,
  ) {
    super();
  }

  async providerRecordsIn(window: ReconWindow): Promise<ReconRecord[]> {
    const intents = await this.stripe.paymentIntents
      .list({ created: { gte: seconds(window.from), lt: seconds(window.to) }, limit: 100 })
      .autoPagingToArray({ limit: MAX_INTENTS_PER_WINDOW });
    return intents.flatMap(toRecord);
  }

  async providerRecordsFor(subjects: string[]): Promise<ReconRecord[]> {
    const records: ReconRecord[] = [];
    for (const subject of subjects) {
      const intentId = subject.slice(SUBJECT_PREFIX.length);
      records.push(...toRecord(await this.stripe.paymentIntents.retrieve(intentId)));
    }
    return records;
  }

  async ledgerRecordsIn(window: ReconWindow): Promise<ReconRecord[]> {
    return this.ledgerRecords({ window });
  }

  async ledgerRecordsFor(subjects: string[]): Promise<ReconRecord[]> {
    return subjects.length === 0 ? [] : this.ledgerRecords({ keys: subjects });
  }

  private async ledgerRecords(scope: { window?: ReconWindow; keys?: string[] }) {
    const rows = await this.ledger.netDebits({
      accountCode: paymentAccounts.providerReceivable(PROVIDER, 'USD').code,
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

/** Only intents we created and that captured money; anything else has nothing to compare. */
function toRecord(intent: StripeIntentSummary): ReconRecord[] {
  const metadata = intent.metadata as Record<string, string | undefined>;
  if (intent.status !== 'succeeded' || !metadata.attemptId) return [];
  return [
    {
      subject: providerPaymentExternalId(PROVIDER, intent.id),
      organizationId: metadata.organizationId ?? null,
      chargeId: metadata.chargeId ?? null,
      currency: intent.currency.toUpperCase(),
      amount: BigInt(intent.amount_received),
    },
  ];
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);
