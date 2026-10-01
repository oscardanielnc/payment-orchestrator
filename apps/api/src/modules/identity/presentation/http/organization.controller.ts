import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetOrganizationUseCase } from '../../application/use-cases/get-organization.use-case';
import { ApiKeyGuard } from './api-key.guard';
import { CurrentOrganization } from './current-organization.decorator';

@Controller('organization')
@UseGuards(ApiKeyGuard)
export class OrganizationController {
  constructor(private readonly getOrganization: GetOrganizationUseCase) {}

  @Get()
  async current(@CurrentOrganization() organizationId: string) {
    const organization = await this.getOrganization.execute(organizationId);
    return {
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt.toISOString(),
    };
  }
}
