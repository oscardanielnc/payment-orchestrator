/** One side's view of a subject: what the provider says, or what our ledger says. */
export interface ReconRecord {
  /** What is being compared, e.g. `provider-payment:stripe:pi_…` or `deposits:base-sepolia:<charge>`. */
  subject: string;
  organizationId: string | null;
  chargeId: string | null;
  currency: string;
  /** Minor units. Zero means "nothing there", the same as no record. */
  amount: bigint;
}

export type FindingKind = 'missing_in_ledger' | 'missing_at_provider' | 'amount_mismatch';

export interface Discrepancy {
  kind: FindingKind;
  subject: string;
  organizationId: string | null;
  chargeId: string | null;
  currency: string;
  providerAmount: bigint;
  ledgerAmount: bigint;
}

export interface Comparison {
  /** Subjects where both sides agree. */
  matched: string[];
  discrepancies: Discrepancy[];
}

/**
 * Pure comparison of both sides, subject by subject. Deterministic: same input, same output,
 * sorted by subject. Amounts in different currencies never match.
 *
 *   provider only            → missing_in_ledger    (money we never recorded)
 *   ledger only              → missing_at_provider  (money we recorded that does not exist)
 *   both, different amount   → amount_mismatch
 */
export function compareRecords(provider: ReconRecord[], ledger: ReconRecord[]): Comparison {
  const providerBy = indexBySubject(provider);
  const ledgerBy = indexBySubject(ledger);
  const subjects = [...new Set([...providerBy.keys(), ...ledgerBy.keys()])].sort();

  const matched: string[] = [];
  const discrepancies: Discrepancy[] = [];
  for (const subject of subjects) {
    const p = providerBy.get(subject);
    const l = ledgerBy.get(subject);
    const providerAmount = p?.amount ?? 0n;
    const ledgerAmount = l?.amount ?? 0n;
    const sameCurrency = !p || !l || p.currency === l.currency;
    if (providerAmount === ledgerAmount && sameCurrency) {
      if (providerAmount !== 0n) matched.push(subject);
      continue;
    }

    const known = (p ?? l) as ReconRecord;
    discrepancies.push({
      kind:
        ledgerAmount === 0n
          ? 'missing_in_ledger'
          : providerAmount === 0n
            ? 'missing_at_provider'
            : 'amount_mismatch',
      subject,
      organizationId: l?.organizationId ?? known.organizationId,
      chargeId: l?.chargeId ?? known.chargeId,
      currency: known.currency,
      providerAmount,
      ledgerAmount,
    });
  }
  return { matched, discrepancies };
}

/** Records with the same subject are added up (e.g. a charge paid to two addresses). */
function indexBySubject(records: ReconRecord[]): Map<string, ReconRecord> {
  const bySubject = new Map<string, ReconRecord>();
  for (const record of records) {
    const existing = bySubject.get(record.subject);
    bySubject.set(
      record.subject,
      existing ? { ...existing, amount: existing.amount + record.amount } : { ...record },
    );
  }
  return bySubject;
}
