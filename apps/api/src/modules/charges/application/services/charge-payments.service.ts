import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { Outbox } from '../../../../shared/application/ports/outbox';
import type { Money } from '../../../../shared/domain/money';
import { ChargeNotFoundError } from '../../domain/errors';
import { ChargeRepository } from '../ports/charge.repository';

/** What another module may know about a charge it is about to collect. */
export interface PayableCharge {
  id: string;
  organizationId: string;
  amount: Money;
}

/**
 * Public API of the charges module for payment flows. Other modules never touch the
 * Charge entity or its repository; they go through here. Callers provide the transaction.
 */
@Injectable()
export class ChargePaymentsService {
  constructor(
    private readonly charges: ChargeRepository,
    private readonly outbox: Outbox,
    private readonly clock: Clock,
  ) {}

  /** Marks the start of a payment attempt; fails if the charge cannot be paid anymore. */
  async beginAttempt(organizationId: string, chargeId: string): Promise<PayableCharge> {
    const charge = await this.charges.findForOrganization(organizationId, chargeId);
    if (!charge) throw new ChargeNotFoundError();

    charge.beginPaymentAttempt(this.clock.now());
    await this.charges.save(charge);
    await this.outbox.add(charge.pullEvents());
    return { id: charge.id, organizationId: charge.organizationId, amount: charge.amount };
  }
}
