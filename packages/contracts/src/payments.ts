import { z } from 'zod';
import { MinorUnits } from './money';

export const PaymentMethod = z.enum(['card', 'mercadopago', 'usdt_tron', 'usdc_base']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const StartPaymentAttemptRequest = z.strictObject({
  method: PaymentMethod,
});
export type StartPaymentAttemptRequest = z.infer<typeof StartPaymentAttemptRequest>;

/** What the customer has to do to pay, depending on the provider. */
export const PaymentInstructions = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('card_client_secret'),
    /** For the provider's own card UI; card data never reaches our servers. */
    clientSecret: z.string(),
  }),
  z.object({ type: z.literal('redirect'), url: z.url() }),
  z.object({
    type: z.literal('crypto_transfer'),
    network: z.enum(['tron-nile', 'base-sepolia']),
    token: z.enum(['USDT', 'USDC']),
    address: z.string(),
    /** Exact amount in the token's minor units. */
    amount: MinorUnits,
  }),
]);
export type PaymentInstructions = z.infer<typeof PaymentInstructions>;

export const PaymentAttempt = z.object({
  id: z.uuid(),
  object: z.literal('payment_attempt'),
  chargeId: z.uuid(),
  method: PaymentMethod,
  provider: z.string(),
  status: z.enum(['pending', 'succeeded', 'failed']),
  instructions: PaymentInstructions,
  /** Last decline while the attempt stays open (the customer may retry). */
  failureReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type PaymentAttempt = z.infer<typeof PaymentAttempt>;

export const PaymentAttemptList = z.object({ data: z.array(PaymentAttempt) });
export type PaymentAttemptList = z.infer<typeof PaymentAttemptList>;
