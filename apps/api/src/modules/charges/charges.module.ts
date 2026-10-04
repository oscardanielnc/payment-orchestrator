import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ChargeRepository } from './application/ports/charge.repository';
import { ChargePaymentsService } from './application/services/charge-payments.service';
import { CreateChargeUseCase } from './application/use-cases/create-charge.use-case';
import { GetChargeUseCase } from './application/use-cases/get-charge.use-case';
import { ListChargesUseCase } from './application/use-cases/list-charges.use-case';
import { PrismaChargeRepository } from './infrastructure/persistence/prisma/prisma-charge.repository';
import { ChargesController } from './presentation/http/charges.controller';

@Module({
  // MerchantAuthGuard comes from identity's public API.
  imports: [IdentityModule],
  controllers: [ChargesController],
  providers: [
    { provide: ChargeRepository, useClass: PrismaChargeRepository },
    CreateChargeUseCase,
    GetChargeUseCase,
    ListChargesUseCase,
    ChargePaymentsService,
  ],
  // Public API: other modules use these, never ChargeRepository or the entity.
  exports: [CreateChargeUseCase, GetChargeUseCase, ChargePaymentsService],
})
export class ChargesModule {}
