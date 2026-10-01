export type ChargeStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'expired';

/**
 * Every legal move. Anything not listed is rejected by the entity.
 *
 *   pending ──▶ processing ──▶ succeeded
 *      │             └────────▶ failed
 *      └──────────────────────▶ expired
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<ChargeStatus, readonly ChargeStatus[]>> = {
  pending: ['processing', 'expired'],
  processing: ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
  expired: [],
};

export const FINAL_STATUSES: readonly ChargeStatus[] = ['succeeded', 'failed', 'expired'];
