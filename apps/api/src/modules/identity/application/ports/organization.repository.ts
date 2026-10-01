import type { Organization } from '../../domain/organization';

export abstract class OrganizationRepository {
  abstract save(organization: Organization): Promise<void>;
  abstract findById(id: string): Promise<Organization | null>;
}
