import type { ReconRecord } from '../../domain/compare';
import type { Finding, FindingStatus } from '../../domain/finding';
import type { ReconWindow } from '../../domain/window';

/**
 * One thing to reconcile (a card provider, a chain). Each side is read twice: what had
 * activity in the window, then the subjects the OTHER side mentioned, looked up regardless
 * of time. A payment created at 23:59 and recorded at 00:01 is then compared, not reported.
 */
export abstract class ReconciliationSource {
  abstract readonly id: string;
  abstract providerRecordsIn(window: ReconWindow): Promise<ReconRecord[]>;
  abstract providerRecordsFor(subjects: string[]): Promise<ReconRecord[]>;
  abstract ledgerRecordsIn(window: ReconWindow): Promise<ReconRecord[]>;
  abstract ledgerRecordsFor(subjects: string[]): Promise<ReconRecord[]>;
}

/** The sources enabled in this environment (only providers with configuration). */
export abstract class ReconciliationSources {
  abstract all(): readonly ReconciliationSource[];
  abstract find(id: string): ReconciliationSource | undefined;
}

export interface ReconciliationRun {
  source: string;
  window: ReconWindow;
  matched: number;
  discrepancies: number;
  ranAt: Date;
}

export abstract class ReconciliationRunRepository {
  /** One row per (source, window): running again overwrites it. */
  abstract save(run: ReconciliationRun): Promise<void>;
  abstract exists(source: string, window: ReconWindow): Promise<boolean>;
}

export interface FindingPosition {
  firstSeenAt: Date;
  id: string;
}

export abstract class FindingRepository {
  /** Inserts or updates with optimistic locking. */
  abstract save(finding: Finding): Promise<void>;
  abstract findBySubjects(source: string, subjects: string[]): Promise<Finding[]>;
  abstract findForOrganization(organizationId: string, id: string): Promise<Finding | null>;
  /** Newest first (firstSeenAt desc, id desc), keyset pagination. */
  abstract listForOrganization(query: {
    organizationId: string;
    status: FindingStatus | undefined;
    limit: number;
    after: FindingPosition | null;
  }): Promise<{ items: Finding[]; next: FindingPosition | null }>;
}
