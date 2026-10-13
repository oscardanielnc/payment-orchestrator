/** A half-open time range [from, to). Reconciliation runs are per source and window. */
export interface ReconWindow {
  from: Date;
  to: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC day containing `date`, e.g. 2026-10-12T00:00Z → 2026-10-13T00:00Z. */
export function utcDay(date: Date): ReconWindow {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

/** Yesterday in UTC: the window the daily job reconciles (today is still moving). */
export function previousUtcDay(now: Date): ReconWindow {
  return utcDay(new Date(now.getTime() - DAY_MS));
}
