import { Injectable } from '@nestjs/common';
import { Outbox, type StoredDomainEvent } from '../../../../shared/application/ports/outbox';
import { GetChargeUseCase } from './get-charge.use-case';

/** A charge's timeline, read from the domain events it produced (charge.created, …). */
@Injectable()
export class ListChargeEventsUseCase {
  constructor(
    private readonly getCharge: GetChargeUseCase,
    private readonly outbox: Outbox,
  ) {}

  async execute(input: { organizationId: string; chargeId: string }): Promise<StoredDomainEvent[]> {
    await this.getCharge.execute(input); // 404 for unknown or foreign charges
    return this.outbox.listForAggregate(input.organizationId, 'charge', input.chargeId);
  }
}
