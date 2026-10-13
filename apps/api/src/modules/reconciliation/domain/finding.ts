import type { Discrepancy, FindingKind } from './compare';
import { FindingNotOpenError } from './errors';

export type FindingStatus = 'open' | 'resolved' | 'cleared';

export interface FindingProps {
  id: string;
  source: string;
  kind: FindingKind;
  subject: string;
  organizationId: string | null;
  chargeId: string | null;
  currency: string;
  providerAmount: bigint;
  ledgerAmount: bigint;
  status: FindingStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  note: string | null;
  version: number;
}

/**
 * A difference between a provider and our ledger, kept until a person looks at it.
 * It never changes the ledger: fixing money is a deliberate, separate posting.
 *
 *   open ──resolve (a person)──▶ resolved
 *   open ──a later run matches──▶ cleared      (e.g. a late webhook arrived)
 *   resolved/cleared ──seen again, different──▶ open
 */
export class Finding {
  private constructor(private props: FindingProps) {}

  static open(input: { id: string; source: string; discrepancy: Discrepancy; now: Date }): Finding {
    const { discrepancy: d, now } = input;
    return new Finding({
      id: input.id,
      source: input.source,
      kind: d.kind,
      subject: d.subject,
      organizationId: d.organizationId,
      chargeId: d.chargeId,
      currency: d.currency,
      providerAmount: d.providerAmount,
      ledgerAmount: d.ledgerAmount,
      status: 'open',
      firstSeenAt: now,
      lastSeenAt: now,
      resolvedAt: null,
      resolvedBy: null,
      note: null,
      version: 0,
    });
  }

  static restore(props: FindingProps): Finding {
    return new Finding({ ...props });
  }

  /** A run saw this difference again. A resolution stands only if nothing changed since. */
  observe(d: Discrepancy, now: Date): void {
    const changed =
      d.kind !== this.props.kind ||
      d.providerAmount !== this.props.providerAmount ||
      d.ledgerAmount !== this.props.ledgerAmount;
    this.props = {
      ...this.props,
      kind: d.kind,
      providerAmount: d.providerAmount,
      ledgerAmount: d.ledgerAmount,
      lastSeenAt: now,
    };
    if (this.props.status === 'cleared' || (this.props.status === 'resolved' && changed)) {
      this.props = { ...this.props, status: 'open', resolvedAt: null, resolvedBy: null };
    }
  }

  /** A run found both sides in agreement. */
  clear(now: Date): void {
    if (this.props.status !== 'open') return;
    this.props = { ...this.props, status: 'cleared', lastSeenAt: now };
  }

  resolve(input: { userId: string; note: string | null; now: Date }): void {
    if (this.props.status !== 'open') throw new FindingNotOpenError();
    this.props = {
      ...this.props,
      status: 'resolved',
      resolvedAt: input.now,
      resolvedBy: input.userId,
      note: input.note,
    };
  }

  markPersisted(version: number): void {
    this.props = { ...this.props, version };
  }

  get id() {
    return this.props.id;
  }
  get source() {
    return this.props.source;
  }
  get kind() {
    return this.props.kind;
  }
  get subject() {
    return this.props.subject;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get chargeId() {
    return this.props.chargeId;
  }
  get currency() {
    return this.props.currency;
  }
  get providerAmount() {
    return this.props.providerAmount;
  }
  get ledgerAmount() {
    return this.props.ledgerAmount;
  }
  get status() {
    return this.props.status;
  }
  get firstSeenAt() {
    return this.props.firstSeenAt;
  }
  get lastSeenAt() {
    return this.props.lastSeenAt;
  }
  get resolvedAt() {
    return this.props.resolvedAt;
  }
  get resolvedBy() {
    return this.props.resolvedBy;
  }
  get note() {
    return this.props.note;
  }
  get version() {
    return this.props.version;
  }
}
