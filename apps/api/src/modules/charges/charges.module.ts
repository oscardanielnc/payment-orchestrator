import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ChargeRepository } from './application/ports/charge.repository';
import { ChargePaymentsService } from './application/services/charge-payments.service';
import { CreateChargeUseCase } from './application/use-cases/create-charge.use-case';
import { ExpireChargesUseCase } from './application/use-cases/expire-charges.use-case';
import { GetChargeByCheckoutTokenUseCase } from './application/use-cases/get-charge-by-checkout-token.use-case';
import { GetChargeUseCase } from './application/use-cases/get-charge.use-case';
import { ListChargeEventsUseCase } from './application/use-cases/list-charge-events.use-case';
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
    ListChargeEventsUseCase,
    GetChargeByCheckoutTokenUseCase,
    ExpireChargesUseCase,
    ChargePaymentsService,
  ],
  // Public API: other modules use these, never ChargeRepository or the entity.
  exports: [
    CreateChargeUseCase,
    GetChargeUseCase,
    GetChargeByCheckoutTokenUseCase,
    ExpireChargesUseCase,
    ChargePaymentsService,
  ],
})
export class ChargesModule {}
