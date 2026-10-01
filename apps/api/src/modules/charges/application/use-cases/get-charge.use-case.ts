import { Injectable } from '@nestjs/common';
import type { Charge } from '../../domain/charge';
import { ChargeNotFoundError } from '../../domain/errors';
import { ChargeRepository } from '../ports/charge.repository';

@Injectable()
export class GetChargeUseCase {
  constructor(private readonly charges: ChargeRepository) {}

  async execute(input: { organizationId: string; chargeId: string }): Promise<Charge> {
    const charge = await this.charges.findForOrganization(input.organizationId, input.chargeId);
    if (!charge) throw new ChargeNotFoundError();
    return charge;
  }
}
