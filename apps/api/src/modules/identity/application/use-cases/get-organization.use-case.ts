import { Injectable } from '@nestjs/common';
import { OrganizationNotFoundError } from '../../domain/errors';
import type { Organization } from '../../domain/organization';
import { OrganizationRepository } from '../ports/organization.repository';

@Injectable()
export class GetOrganizationUseCase {
  constructor(private readonly organizations: OrganizationRepository) {}

  async execute(organizationId: string): Promise<Organization> {
    const organization = await this.organizations.findById(organizationId);
    if (!organization) throw new OrganizationNotFoundError();
    return organization;
  }
}
