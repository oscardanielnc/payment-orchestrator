import { Injectable } from '@nestjs/common';
import { GetChargeUseCase } from '../../../charges/application/use-cases/get-charge.use-case';
import type { PaymentAttempt } from '../../domain/payment-attempt';
import { PaymentAttemptRepository } from '../ports/payment-attempt.repository';

@Injectable()
export class ListPaymentAttemptsUseCase {
  constructor(
    private readonly getCharge: GetChargeUseCase,
    private readonly attempts: PaymentAttemptRepository,
  ) {}

  async execute(input: { organizationId: string; chargeId: string }): Promise<PaymentAttempt[]> {
    await this.getCharge.execute(input); // 404 for unknown or foreign charges
    return this.attempts.listForCharge(input.organizationId, input.chargeId);
  }
}
