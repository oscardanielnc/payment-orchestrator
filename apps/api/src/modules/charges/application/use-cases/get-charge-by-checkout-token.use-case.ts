import { Injectable } from '@nestjs/common';
import type { Charge } from '../../domain/charge';
import { ChargeNotFoundError } from '../../domain/errors';
import { ChargeRepository } from '../ports/charge.repository';

/** Public lookup for the hosted checkout. An unknown token is a plain 404, like a foreign charge. */
@Injectable()
export class GetChargeByCheckoutTokenUseCase {
  constructor(private readonly charges: ChargeRepository) {}

  async execute(token: string): Promise<Charge> {
    const charge = await this.charges.findByCheckoutToken(token);
    if (!charge) throw new ChargeNotFoundError();
    return charge;
  }
}
