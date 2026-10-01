import type { Charge } from '../../domain/charge';

/** Position in the list: charges are ordered by `createdAt` desc, then `id` desc. */
export interface ChargePosition {
  createdAt: Date;
  id: string;
}

export interface ChargePage {
  items: Charge[];
  /** Position of the last item when more items exist; `null` on the last page. */
  next: ChargePosition | null;
}

export abstract class ChargeRepository {
  /**
   * Inserts a new charge or updates an existing one. Fails with ConcurrencyConflictError
   * if the stored version differs from `charge.version` (someone saved it in between).
   */
  abstract save(charge: Charge): Promise<void>;
  /** Scoped by organization: another organization's charge is `null`, never leaked. */
  abstract findForOrganization(organizationId: string, id: string): Promise<Charge | null>;
  abstract listForOrganization(
    organizationId: string,
    page: { limit: number; after: ChargePosition | null },
  ): Promise<ChargePage>;
}
