import { Money } from '../../../shared/domain/money';
import type { CryptoNetwork } from './network';

export type DepositStatus = 'awaiting' | 'partial' | 'funded' | 'overfunded';

/** Result of crediting a transfer, for whoever drives the payment state. */
export interface DepositCredit {
  depositAddressId: string;
  attemptId: string;
  chargeId: string;
  organizationId: string;
  expected: Money;
  received: Money;
  status: DepositStatus;
  /** True only for the transfer that first reached the expected amount. */
  justFunded: boolean;
}

export interface DepositAddressProps {
  id: string;
  network: CryptoNetwork;
  /** Display form (base58 for TRON). */
  address: string;
  /** Lowercase 20-byte hex: how chain events identify the recipient. */
  matchKey: string;
  derivationIndex: number;
  attemptId: string;
  chargeId: string;
  organizationId: string;
  expected: Money;
  received: Money;
  createdAt: Date;
  version: number;
}

/**
 * One address per payment attempt. Sums every transfer it receives and decides whether
 * the expected amount was reached (ADR 0010):
 *   received < expected  → partial (charge stays open until it expires)
 *   received = expected  → funded
 *   received > expected  → overfunded (still paid; the excess is recorded)
 */
export class DepositAddress {
  private constructor(private props: DepositAddressProps) {}

  static create(
    input: Omit<DepositAddressProps, 'received' | 'version' | 'createdAt'> & { now: Date },
  ): DepositAddress {
    const { now, ...rest } = input;
    return new DepositAddress({
      ...rest,
      received: Money.of(0n, input.expected.currency),
      createdAt: now,
      version: 0,
    });
  }

  static restore(props: DepositAddressProps): DepositAddress {
    return new DepositAddress({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get network(): CryptoNetwork {
    return this.props.network;
  }
  get address(): string {
    return this.props.address;
  }
  get matchKey(): string {
    return this.props.matchKey;
  }
  get derivationIndex(): number {
    return this.props.derivationIndex;
  }
  get attemptId(): string {
    return this.props.attemptId;
  }
  get chargeId(): string {
    return this.props.chargeId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get expected(): Money {
    return this.props.expected;
  }
  get received(): Money {
    return this.props.received;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get version(): number {
    return this.props.version;
  }

  get status(): DepositStatus {
    return statusOf(this.props.received.amount, this.props.expected.amount);
  }

  credit(amount: bigint): DepositCredit {
    const wasFunded = this.props.received.amount >= this.props.expected.amount;
    this.props.received = this.props.received.add(Money.of(amount, this.props.expected.currency));
    const status = this.status;
    return {
      depositAddressId: this.props.id,
      attemptId: this.props.attemptId,
      chargeId: this.props.chargeId,
      organizationId: this.props.organizationId,
      expected: this.props.expected,
      received: this.props.received,
      status,
      justFunded: !wasFunded && (status === 'funded' || status === 'overfunded'),
    };
  }

  markPersisted(version: number): void {
    this.props.version = version;
  }
}

function statusOf(received: bigint, expected: bigint): DepositStatus {
  if (received === 0n) return 'awaiting';
  if (received < expected) return 'partial';
  return received === expected ? 'funded' : 'overfunded';
}
