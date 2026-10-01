import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { ChargePaymentsService } from '../../../charges/application/services/charge-payments.service';
import { PaymentMethodUnavailableError } from '../../domain/errors';
import { PaymentAttempt } from '../../domain/payment-attempt';
import { type PaymentMethod, resolveRoute } from '../../domain/payment-route';
import { PaymentAttemptRepository } from '../ports/payment-attempt.repository';
import { PaymentProviderRegistry } from '../ports/payment-provider-registry';
import { RoutingTable } from '../ports/routing-table';

/**
 * The orchestration step: charge + method → route → provider → attempt with instructions.
 *
 *   ChargePaymentsService.beginAttempt   (charge must be open; pending → processing)
 *   resolveRoute(table, method, currency) (which provider?)
 *   provider.createPayment(...)           (address, client secret, redirect...)
 *   save attempt
 */
@Injectable()
export class StartPaymentAttemptUseCase {
  constructor(
    private readonly charges: ChargePaymentsService,
    private readonly routing: RoutingTable,
    private readonly providers: PaymentProviderRegistry,
    private readonly attempts: PaymentAttemptRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  execute(input: {
    organizationId: string;
    chargeId: string;
    method: PaymentMethod;
  }): Promise<PaymentAttempt> {
    return this.transaction.run(async () => {
      const charge = await this.charges.beginAttempt(input.organizationId, input.chargeId);

      const route = resolveRoute(this.routing.routes(), input.method, charge.amount.currency);
      const provider = this.providers.find(route.provider);
      if (!provider) throw new PaymentMethodUnavailableError(input.method);

      const attemptId = this.ids.uuid();
      // Runs inside the transaction: if saving fails, the provider call is retried with the
      // same attemptId as its idempotency key, so no duplicate payment is created upstream.
      const payment = await provider.createPayment({
        attemptId,
        chargeId: charge.id,
        organizationId: charge.organizationId,
        method: input.method,
        amount: charge.amount,
      });

      const attempt = PaymentAttempt.start({
        id: attemptId,
        chargeId: charge.id,
        organizationId: charge.organizationId,
        method: input.method,
        provider: route.provider,
        externalReference: payment.externalReference,
        instructions: payment.instructions,
        now: this.clock.now(),
      });
      await this.attempts.save(attempt);
      return attempt;
    });
  }
}
