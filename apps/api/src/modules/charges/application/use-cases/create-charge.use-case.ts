import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { Outbox } from '../../../../shared/application/ports/outbox';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { Money } from '../../../../shared/domain/money';
import { Charge } from '../../domain/charge';
import { ChargeRepository } from '../ports/charge.repository';

export const DEFAULT_EXPIRY_SECONDS = 30 * 60;

export interface CreateChargeInput {
  organizationId: string;
  /** Minor units, as a string of digits. */
  amount: string;
  currency: string;
  description?: string;
  reference?: string;
  expiresInSeconds?: number;
}

@Injectable()
export class CreateChargeUseCase {
  constructor(
    private readonly charges: ChargeRepository,
    private readonly outbox: Outbox,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(input: CreateChargeInput): Promise<Charge> {
    const charge = Charge.create({
      id: this.ids.uuid(),
      organizationId: input.organizationId,
      amount: Money.fromMinorUnits(input.amount, input.currency),
      description: input.description,
      reference: input.reference,
      expiresInSeconds: input.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS,
      now: this.clock.now(),
    });

    // The charge and its `charge.created` event commit together or not at all.
    await this.transaction.run(async () => {
      await this.charges.save(charge);
      await this.outbox.add(charge.pullEvents());
    });
    return charge;
  }
}
