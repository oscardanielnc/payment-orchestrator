import type { DepositCredit } from '../../../crypto/domain/deposit-address';
import type { CryptoNetwork } from '../../../crypto/domain/network';
import type { LedgerAccountRef } from '../../../ledger/domain/ledger-account';
import type { PostInput } from '../../../ledger/application/services/ledger.service';
import { Money } from '../../../../shared/domain/money';

/**
 * Chart of accounts for payments, and which accounts each event moves (ADR 0009).
 *
 *   platform:<network>:deposits    asset      debit-normal   tokens sitting in our addresses
 *   merchant:<org>:awaiting        liability  credit-normal  received for a charge not paid yet
 *   merchant:<org>:available       liability  credit-normal  from paid charges: owed to the merchant
 *   merchant:<org>:overpayments    liability  credit-normal  received beyond the charge amount
 *   platform:<provider>:receivable asset      debit-normal   captured by a card provider, not paid out yet
 */
export const paymentAccounts = {
  providerReceivable: (provider: string, currency: string): LedgerAccountRef => ({
    code: `platform:${provider}:receivable`,
    currency,
    name: `Receivable from ${provider}`,
    normalBalance: 'debit',
    organizationId: null,
  }),
  cryptoDeposits: (network: CryptoNetwork, currency: string): LedgerAccountRef => ({
    code: `platform:${network}:deposits`,
    currency,
    name: `Deposits on ${network}`,
    normalBalance: 'debit',
    organizationId: null,
  }),
  awaiting: (organizationId: string, currency: string): LedgerAccountRef => ({
    code: `merchant:${organizationId}:awaiting`,
    currency,
    name: 'Awaiting settlement',
    normalBalance: 'credit',
    organizationId,
  }),
  available: (organizationId: string, currency: string): LedgerAccountRef => ({
    code: `merchant:${organizationId}:available`,
    currency,
    name: 'Available',
    normalBalance: 'credit',
    organizationId,
  }),
  overpayments: (organizationId: string, currency: string): LedgerAccountRef => ({
    code: `merchant:${organizationId}:overpayments`,
    currency,
    name: 'Overpayments',
    normalBalance: 'credit',
    organizationId,
  }),
};

/**
 * A confirmed transfer reached one of our addresses: the platform holds more tokens, and
 * owes them to the merchant. Before the charge is paid they wait in `awaiting`; once the
 * deposit was already funded, anything extra is an overpayment.
 */
export function transferReceived(input: {
  credit: DepositCredit;
  network: CryptoNetwork;
  externalId: string;
  amount: bigint;
}): PostInput {
  const { credit, network } = input;
  const currency = credit.expected.currency;
  const amount = Money.of(input.amount, currency);
  const alreadyFunded =
    !credit.justFunded && credit.received.amount - input.amount >= credit.expected.amount;
  return {
    externalId: input.externalId,
    organizationId: credit.organizationId,
    reference: credit.chargeId,
    description: `${currency} received on ${network}`,
    lines: [
      { account: paymentAccounts.cryptoDeposits(network, currency), direction: 'debit', amount },
      {
        account: alreadyFunded
          ? paymentAccounts.overpayments(credit.organizationId, currency)
          : paymentAccounts.awaiting(credit.organizationId, currency),
        direction: 'credit',
        amount,
      },
    ],
  };
}

/** The charge is paid: what waited moves to available, any excess to overpayments. */
export function chargeSettled(credit: DepositCredit): PostInput {
  const currency = credit.expected.currency;
  const org = credit.organizationId;
  const excess = credit.received.amount - credit.expected.amount;
  return {
    externalId: `charge-settled:${credit.chargeId}`,
    organizationId: org,
    reference: credit.chargeId,
    description: 'Charge paid',
    lines: [
      {
        account: paymentAccounts.awaiting(org, currency),
        direction: 'debit',
        amount: credit.received,
      },
      {
        account: paymentAccounts.available(org, currency),
        direction: 'credit',
        amount: credit.expected,
      },
      ...(excess > 0n
        ? [
            {
              account: paymentAccounts.overpayments(org, currency),
              direction: 'credit' as const,
              amount: Money.of(excess, currency),
            },
          ]
        : []),
    ],
  };
}

/** The ledger transaction of a captured provider payment; reconciliation looks it up by this. */
export const providerPaymentExternalId = (provider: string, externalReference: string) =>
  `provider-payment:${provider}:${externalReference}`;

/**
 * A card provider captured the payment: it now owes us the money (receivable) and we owe it
 * to the merchant. If the charge had already closed, it waits in `awaiting` for reconciliation.
 */
export function providerPaymentCaptured(input: {
  provider: string;
  externalReference: string;
  organizationId: string;
  chargeId: string;
  amount: Money;
  chargePaid: boolean;
}): PostInput {
  const { amount, organizationId: org } = input;
  return {
    externalId: providerPaymentExternalId(input.provider, input.externalReference),
    organizationId: org,
    reference: input.chargeId,
    description: `Card payment captured by ${input.provider}`,
    lines: [
      {
        account: paymentAccounts.providerReceivable(input.provider, amount.currency),
        direction: 'debit',
        amount,
      },
      {
        account: input.chargePaid
          ? paymentAccounts.available(org, amount.currency)
          : paymentAccounts.awaiting(org, amount.currency),
        direction: 'credit',
        amount,
      },
    ],
  };
}
