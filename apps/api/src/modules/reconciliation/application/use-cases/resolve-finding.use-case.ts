import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { FindingNotFoundError } from '../../domain/errors';
import type { Finding } from '../../domain/finding';
import { FindingRepository } from '../ports/reconciliation-ports';

/**
 * A person looked at a finding and decided. Resolving records who and why; it does not
 * touch the ledger (a correction, if any, is a separate deliberate posting).
 */
@Injectable()
export class ResolveFindingUseCase {
  constructor(
    private readonly findings: FindingRepository,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  execute(input: {
    organizationId: string;
    findingId: string;
    userId: string;
    note: string | null;
  }): Promise<Finding> {
    return this.transaction.run(async () => {
      const finding = await this.findings.findForOrganization(
        input.organizationId,
        input.findingId,
      );
      if (!finding) throw new FindingNotFoundError();
      finding.resolve({ userId: input.userId, note: input.note, now: this.clock.now() });
      await this.findings.save(finding);
      return finding;
    });
  }
}
