import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import type { BalanceList, CurrencyCode, LedgerEntryList } from '@po/contracts';
import { ApiKeyGuard } from '../../../identity/presentation/http/api-key.guard';
import { CurrentOrganization } from '../../../identity/presentation/http/current-organization.decorator';
import { LedgerService } from '../../application/services/ledger.service';

@Controller()
@UseGuards(ApiKeyGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  /** The merchant's accounts and their balances, derived from entries. */
  @Get('balances')
  async balances(@CurrentOrganization() organizationId: string): Promise<BalanceList> {
    const balances = await this.ledger.balancesFor(organizationId);
    return {
      data: balances.map(({ account, posted, pending }) => ({
        account: account.code,
        name: account.name,
        currency: account.currency as CurrencyCode,
        posted: posted.toMinorUnits(),
        pending: pending.toMinorUnits(),
      })),
    };
  }

  /** Every ledger entry about one charge: what the dashboard's charge detail shows. */
  @Get('charges/:chargeId/ledger-entries')
  async entries(
    @CurrentOrganization() organizationId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
  ): Promise<LedgerEntryList> {
    const entries = await this.ledger.entriesFor(organizationId, chargeId);
    return {
      data: entries.map((entry) => ({
        transactionId: entry.transactionId,
        description: entry.description,
        status: entry.status as LedgerEntryList['data'][number]['status'],
        effectiveAt: entry.effectiveAt.toISOString(),
        account: entry.accountCode,
        accountName: entry.accountName,
        normalBalance: entry.normalBalance as 'debit' | 'credit',
        direction: entry.direction,
        amount: entry.amount.toMinorUnits(),
        currency: entry.amount.currency as CurrencyCode,
      })),
    };
  }
}
