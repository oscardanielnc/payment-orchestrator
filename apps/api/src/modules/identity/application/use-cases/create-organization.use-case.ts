import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { Organization } from '../../domain/organization';
import { ApiKeyRepository } from '../ports/api-key.repository';
import { OrganizationRepository } from '../ports/organization.repository';
import { ApiKeyIssuer } from '../services/api-key-issuer';

export interface CreateOrganizationResult {
  organization: Organization;
  apiKeyId: string;
  token: string;
}

/** Creates an organization together with its first API key, atomically. */
@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly apiKeys: ApiKeyRepository,
    private readonly issuer: ApiKeyIssuer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(input: { name: string; firstKeyName?: string }): Promise<CreateOrganizationResult> {
    const organization = Organization.create({
      id: this.ids.uuid(),
      name: input.name,
      now: this.clock.now(),
    });
    const { apiKey, token } = this.issuer.issue(organization.id, input.firstKeyName ?? 'Default');

    return this.transaction.run(async () => {
      await this.organizations.save(organization);
      await this.apiKeys.save(apiKey);
      return { organization, apiKeyId: apiKey.id, token };
    });
  }
}
