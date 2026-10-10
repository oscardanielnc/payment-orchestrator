import type { Money } from '../../../shared/domain/money';

/** What a card/local provider says about one of our payments, from a webhook or a status check. */
export type ProviderOutcome =
  | { kind: 'succeeded'; amount: Money }
  /** One try failed; the customer may retry on the same provider payment. Not terminal. */
  | { kind: 'declined'; reason: string }
  /** The provider payment is closed for good. */
  | { kind: 'canceled' };
