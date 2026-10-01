import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ChargeRepository } from './application/ports/charge.repository';
import { CreateChargeUseCase } from './application/use-cases/create-charge.use-case';
import { GetChargeUseCase } from './application/use-cases/get-charge.use-case';
import { ListChargesUseCase } from './application/use-cases/list-charges.use-case';
import { PrismaChargeRepository } from './infrastructure/persistence/prisma/prisma-charge.repository';
import { ChargesController } from './presentation/http/charges.controller';

@Module({
  // ApiKeyGuard comes from identity's public API.
  imports: [IdentityModule],
  controllers: [ChargesController],
  providers: [
    { provide: ChargeRepository, useClass: PrismaChargeRepository },
    CreateChargeUseCase,
    GetChargeUseCase,
    ListChargesUseCase,
  ],
  exports: [CreateChargeUseCase, GetChargeUseCase],
})
export class ChargesModule {}
