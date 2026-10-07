import { z } from 'zod';
import { ChargeStatus } from './charges';
import { CurrencyCode, MinorUnits } from './money';
import { PaymentInstructions, PaymentMethod } from './payments';

/** Path segment of a checkout URL: 128 random bits in base64url (older charges: 32 hex chars). */
export const CheckoutToken = z.string().regex(/^[A-Za-z0-9_-]{22,64}$/);

/** The customer's current attempt: only what the payer needs to see. */
export const CheckoutAttempt = z.object({
  method: PaymentMethod,
  status: z.enum(['pending', 'succeeded', 'failed']),
  instructions: PaymentInstructions,
  failureReason: z.string().nullable(),
});
export type CheckoutAttempt = z.infer<typeof CheckoutAttempt>;

/**
 * Public view of a charge for its hosted checkout. No ids, no merchant reference:
 * whoever holds the link sees only what paying requires.
 */
export const CheckoutSession = z.object({
  merchantName: z.string(),
  amount: MinorUnits,
  currency: CurrencyCode,
  description: z.string().nullable(),
  /** `expired` as soon as the expiry passes, even before the sweep stores it. */
  status: ChargeStatus,
  expiresAt: z.iso.datetime(),
  /** Methods enabled for this currency in this environment (testnets only). */
  methods: z.array(PaymentMethod),
  attempt: CheckoutAttempt.nullable(),
  /** For Stripe.js when card is available; always a pk_test_ key. */
  stripePublishableKey: z.string().nullable(),
});
export type CheckoutSession = z.infer<typeof CheckoutSession>;

export const StartCheckoutAttemptRequest = z.strictObject({ method: PaymentMethod });
export type StartCheckoutAttemptRequest = z.infer<typeof StartCheckoutAttemptRequest>;
