import type { Charge as ChargeResponse } from '@po/contracts';
import type { Charge } from '../../domain/charge';

/** Domain → API contract. Money leaves as a string of minor units. */
export function presentCharge(charge: Charge): ChargeResponse {
  return {
    id: charge.id,
    object: 'charge',
    amount: charge.amount.toMinorUnits(),
    currency: charge.amount.currency as ChargeResponse['currency'],
    status: charge.status,
    description: charge.description,
    reference: charge.reference,
    expiresAt: charge.expiresAt.toISOString(),
    createdAt: charge.createdAt.toISOString(),
    updatedAt: charge.updatedAt.toISOString(),
  };
}
