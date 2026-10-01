import { Money } from '../../../../../shared/domain/money';
import { Prisma, type Charge as ChargeRow } from '../../../../../generated/prisma/client';
import { Charge } from '../../../domain/charge';

/** NUMERIC(78,0) ⇄ bigint, through strings: never through JavaScript numbers. */
export const chargeMapper = {
  toDomain(row: ChargeRow): Charge {
    return Charge.restore({
      id: row.id,
      organizationId: row.organizationId,
      amount: Money.fromMinorUnits(row.amount.toFixed(0), row.currency),
      status: row.status,
      description: row.description,
      reference: row.reference,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  },

  toRow(charge: Charge): ChargeRow {
    return {
      id: charge.id,
      organizationId: charge.organizationId,
      amount: new Prisma.Decimal(charge.amount.toMinorUnits()),
      currency: charge.amount.currency,
      status: charge.status,
      description: charge.description,
      reference: charge.reference,
      expiresAt: charge.expiresAt,
      createdAt: charge.createdAt,
      updatedAt: charge.updatedAt,
      version: charge.version,
    };
  },
};
