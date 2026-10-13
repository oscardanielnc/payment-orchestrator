import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ListReconciliationFindingsQuery,
  type ReconciliationFinding as FindingResponse,
  type ReconciliationFindingList,
  ResolveReconciliationFindingRequest,
} from '@po/contracts';
import { UnauthenticatedError } from '../../../identity/domain/errors';
import { ZodValidationPipe } from '../../../../shared/presentation/http/zod-validation.pipe';
import type { Principal } from '../../../identity/application/principal';
import {
  CurrentOrganization,
  CurrentPrincipal,
} from '../../../identity/presentation/http/current-organization.decorator';
import { MerchantAuthGuard } from '../../../identity/presentation/http/merchant-auth.guard';
import { Roles, RolesGuard } from '../../../identity/presentation/http/roles.guard';
import { ListFindingsUseCase } from '../../application/use-cases/list-findings.use-case';
import { ResolveFindingUseCase } from '../../application/use-cases/resolve-finding.use-case';
import type { Finding } from '../../domain/finding';

const present = (finding: Finding): FindingResponse => ({
  id: finding.id,
  source: finding.source,
  kind: finding.kind,
  chargeId: finding.chargeId,
  currency: finding.currency,
  providerAmount: finding.providerAmount.toString(),
  ledgerAmount: finding.ledgerAmount.toString(),
  status: finding.status,
  firstSeenAt: finding.firstSeenAt.toISOString(),
  lastSeenAt: finding.lastSeenAt.toISOString(),
  resolvedAt: finding.resolvedAt?.toISOString() ?? null,
  note: finding.note,
});

/** Findings about the caller's own charges. Reading is open to members; resolving is not. */
@Controller('reconciliation/findings')
@UseGuards(MerchantAuthGuard)
export class ReconciliationFindingsController {
  constructor(
    private readonly listFindings: ListFindingsUseCase,
    private readonly resolveFinding: ResolveFindingUseCase,
  ) {}

  @Get()
  async list(
    @CurrentOrganization() organizationId: string,
    @Query(new ZodValidationPipe(ListReconciliationFindingsQuery))
    query: ListReconciliationFindingsQuery,
  ): Promise<ReconciliationFindingList> {
    const page = await this.listFindings.execute({ organizationId, ...query });
    return { data: page.items.map(present), nextCursor: page.nextCursor };
  }

  /** A person signs off on it: owners only, signed in (an API key never passes). */
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('owner')
  async resolve(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) findingId: string,
    @Body(new ZodValidationPipe(ResolveReconciliationFindingRequest))
    body: ResolveReconciliationFindingRequest,
  ): Promise<FindingResponse> {
    if (principal.actor.type !== 'user') throw new UnauthenticatedError();
    const finding = await this.resolveFinding.execute({
      organizationId: principal.organizationId,
      findingId,
      userId: principal.actor.userId,
      note: body.note || null,
    });
    return present(finding);
  }
}
