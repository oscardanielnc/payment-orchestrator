import { z } from 'zod';

export const ReconciliationFindingKind = z.enum([
  'missing_in_ledger',
  'missing_at_provider',
  'amount_mismatch',
]);
export type ReconciliationFindingKind = z.infer<typeof ReconciliationFindingKind>;

export const ReconciliationFindingStatus = z.enum(['open', 'resolved', 'cleared']);
export type ReconciliationFindingStatus = z.infer<typeof ReconciliationFindingStatus>;

export const ReconciliationFinding = z.object({
  id: z.uuid(),
  /** `stripe`, `tron-nile`, `base-sepolia`. */
  source: z.string(),
  kind: ReconciliationFindingKind,
  chargeId: z.uuid().nullable(),
  currency: z.string(),
  /** Minor units, as strings like every amount. */
  providerAmount: z.string(),
  ledgerAmount: z.string(),
  status: ReconciliationFindingStatus,
  firstSeenAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  note: z.string().nullable(),
});
export type ReconciliationFinding = z.infer<typeof ReconciliationFinding>;

export const ReconciliationFindingList = z.object({
  data: z.array(ReconciliationFinding),
  nextCursor: z.string().nullable(),
});
export type ReconciliationFindingList = z.infer<typeof ReconciliationFindingList>;

export const ListReconciliationFindingsQuery = z.strictObject({
  status: ReconciliationFindingStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(200).optional(),
});
export type ListReconciliationFindingsQuery = z.infer<typeof ListReconciliationFindingsQuery>;

export const ResolveReconciliationFindingRequest = z.strictObject({
  /** Why it is fine, or what was done about it. */
  note: z.string().trim().max(500).optional(),
});
export type ResolveReconciliationFindingRequest = z.infer<
  typeof ResolveReconciliationFindingRequest
>;
