import { z } from 'zod';
import { CurrencyCode, MinorUnits } from './money';

export const ChargeStatus = z.enum(['pending', 'processing', 'succeeded', 'failed', 'expired']);
export type ChargeStatus = z.infer<typeof ChargeStatus>;

export const CreateChargeRequest = z.strictObject({
  amount: MinorUnits,
  currency: CurrencyCode,
  description: z.string().trim().min(1).max(200).optional(),
  /** The merchant's own id for this charge (order number, invoice). */
  reference: z.string().trim().min(1).max(100).optional(),
  /** Default 1800 (30 min). Between 1 minute and 7 days. */
  expiresInSeconds: z.number().int().min(60).max(604_800).optional(),
});
export type CreateChargeRequest = z.infer<typeof CreateChargeRequest>;

export const Charge = z.object({
  id: z.uuid(),
  object: z.literal('charge'),
  amount: MinorUnits,
  currency: CurrencyCode,
  status: ChargeStatus,
  description: z.string().nullable(),
  reference: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Charge = z.infer<typeof Charge>;

export const ListChargesQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(200).optional(),
});
export type ListChargesQuery = z.infer<typeof ListChargesQuery>;

export const ChargeList = z.object({
  data: z.array(Charge),
  /** Pass as `cursor` to get the next page; `null` on the last page. */
  nextCursor: z.string().nullable(),
});
export type ChargeList = z.infer<typeof ChargeList>;
