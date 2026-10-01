import { Injectable } from '@nestjs/common';
import { OrganizationNotFoundError } from '../../domain/errors';
import { ApiKeyRepository } from '../ports/api-key.repository';
import { OrganizationRepository } from '../ports/organization.repository';
import { ApiKeyIssuer } from '../services/api-key-issuer';

@Injectable()
export class IssueApiKeyUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly apiKeys: ApiKeyRepository,
    private readonly issuer: ApiKeyIssuer,
  ) {}

  async execute(input: {
    organizationId: string;
    name: string;
  }): Promise<{ apiKeyId: string; token: string }> {
    const organization = await this.organizations.findById(input.organizationId);
    if (!organization) throw new OrganizationNotFoundError();

    const { apiKey, token } = this.issuer.issue(organization.id, input.name);
    await this.apiKeys.save(apiKey);
    return { apiKeyId: apiKey.id, token };
  }
}
