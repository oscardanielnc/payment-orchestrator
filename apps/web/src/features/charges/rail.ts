import type { Charge, LedgerEntry, PaymentAttempt } from '@po/contracts';
import type { Station } from '@po/ui/data-display/PaymentRail/PaymentRail';

const METHOD_LABEL: Record<string, string> = {
  card: 'Card',
  mercadopago: 'Mercado Pago',
  usdt_tron: 'USDT · TRON',
  usdc_base: 'USDC · Base',
};

/**
 * Builds the payment rail from real data only (docs/design/direction.md):
 *   Created → Routed → Paid → Posted, or ending in Failed / Expired.
 */
export function railStations(
  charge: Charge,
  attempts: PaymentAttempt[],
  ledger: LedgerEntry[],
): Station[] {
  const attempt = attempts.find((a) => a.status === 'succeeded') ?? attempts.at(-1);
  const created: Station = { label: 'Created', state: 'done', detail: time(charge.createdAt) };
  const routed: Station = attempt
    ? { label: 'Routed', state: 'done', detail: METHOD_LABEL[attempt.method] ?? attempt.method }
    : { label: 'Routed', state: 'current', detail: 'Waiting for the customer' };

  if (charge.status === 'failed' || charge.status === 'expired') {
    return [
      created,
      routed,
      { label: charge.status === 'failed' ? 'Failed' : 'Expired', state: 'failed' },
    ];
  }

  const paid = charge.status === 'succeeded';
  const posted =
    paid && ledger.some((e) => e.status === 'posted' && e.account.endsWith(':available'));
  return [
    created,
    routed,
    {
      label: 'Paid',
      state: paid ? 'done' : attempt ? 'current' : 'upcoming',
      detail: paid
        ? undefined
        : attempt?.failureReason
          ? `Declined: ${attempt.failureReason}`
          : undefined,
    },
    { label: 'Posted', state: posted ? 'done' : paid ? 'current' : 'upcoming', detail: 'Ledger' },
  ];
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
