import type { Money } from '../../../shared/domain/money';
import {
  InvalidLedgerEntryError,
  InvalidLedgerTransitionError,
  UnbalancedTransactionError,
} from './errors';
import type { Direction } from './ledger-account';

export type LedgerTransactionStatus = 'pending' | 'posted' | 'archived';

export interface LedgerEntry {
  accountId: string;
  direction: Direction;
  /** Always positive; the direction carries the sign. */
  amount: Money;
}

export interface LedgerTransactionProps {
  id: string;
  /** Idempotency: the same business event (e.g. one chain transfer) maps to one transaction. */
  externalId: string;
  organizationId: string | null;
  /** What it is about, e.g. a charge id. */
  reference: string | null;
  description: string;
  status: LedgerTransactionStatus;
  entries: readonly LedgerEntry[];
  effectiveAt: Date;
  postedAt: Date | null;
}

/**
 * A set of entries that moves money between accounts. Entries are immutable; only a pending
 * transaction can change, and only its status (pending → posted | archived). Mistakes are
 * fixed with a reversing transaction, never by editing (ADR 0009).
 */
export class LedgerTransaction {
  private constructor(private props: LedgerTransactionProps) {}

  static record(input: {
    id: string;
    externalId: string;
    organizationId: string | null;
    reference: string | null;
    description: string;
    entries: LedgerEntry[];
    status: 'pending' | 'posted';
    now: Date;
  }): LedgerTransaction {
    assertBalanced(input.entries);
    return new LedgerTransaction({
      id: input.id,
      externalId: input.externalId,
      organizationId: input.organizationId,
      reference: input.reference,
      description: input.description,
      status: input.status,
      entries: [...input.entries],
      effectiveAt: input.now,
      postedAt: input.status === 'posted' ? input.now : null,
    });
  }

  static restore(props: LedgerTransactionProps): LedgerTransaction {
    return new LedgerTransaction({ ...props, entries: [...props.entries] });
  }

  get id(): string {
    return this.props.id;
  }
  get externalId(): string {
    return this.props.externalId;
  }
  get organizationId(): string | null {
    return this.props.organizationId;
  }
  get reference(): string | null {
    return this.props.reference;
  }
  get description(): string {
    return this.props.description;
  }
  get status(): LedgerTransactionStatus {
    return this.props.status;
  }
  get entries(): readonly LedgerEntry[] {
    return this.props.entries;
  }
  get effectiveAt(): Date {
    return this.props.effectiveAt;
  }
  get postedAt(): Date | null {
    return this.props.postedAt;
  }

  post(now: Date): void {
    this.leavePending('posted');
    this.props.postedAt = now;
  }

  archive(): void {
    this.leavePending('archived');
  }

  /** The exact opposite entries: how a posted transaction is corrected. */
  reversalEntries(): LedgerEntry[] {
    return this.props.entries.map((entry) => ({
      ...entry,
      direction: entry.direction === 'debit' ? 'credit' : 'debit',
    }));
  }

  private leavePending(next: LedgerTransactionStatus): void {
    if (this.props.status !== 'pending') {
      throw new InvalidLedgerTransitionError(this.props.status, next);
    }
    this.props.status = next;
  }
}

/** Σ debits = Σ credits in every currency, with at least two positive entries. */
function assertBalanced(entries: readonly LedgerEntry[]): void {
  if (entries.length < 2)
    throw new InvalidLedgerEntryError('a transaction needs at least two entries');
  const totals = new Map<string, { debits: bigint; credits: bigint }>();
  for (const { amount, direction } of entries) {
    if (amount.amount <= 0n) throw new InvalidLedgerEntryError('amounts must be positive');
    const total = totals.get(amount.currency) ?? { debits: 0n, credits: 0n };
    if (direction === 'debit') total.debits += amount.amount;
    else total.credits += amount.amount;
    totals.set(amount.currency, total);
  }
  for (const [currency, { debits, credits }] of totals) {
    if (debits !== credits) throw new UnbalancedTransactionError(currency, debits, credits);
  }
}
