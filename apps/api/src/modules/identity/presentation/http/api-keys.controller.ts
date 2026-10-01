import { Controller, Get, UseGuards } from '@nestjs/common';
import { ListApiKeysUseCase } from '../../application/use-cases/list-api-keys.use-case';
import { ApiKeyGuard } from './api-key.guard';
import { CurrentOrganization } from './current-organization.decorator';

/**
 * Read-only for now. Creating and revoking keys is restricted to organization owners,
 * so those endpoints arrive with dashboard auth (feature 3).
 */
@Controller('api-keys')
@UseGuards(ApiKeyGuard)
export class ApiKeysController {
  constructor(private readonly listApiKeys: ListApiKeysUseCase) {}

  @Get()
  async list(@CurrentOrganization() organizationId: string) {
    const keys = await this.listApiKeys.execute(organizationId);
    return {
      data: keys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        revokedAt: key.revokedAt?.toISOString() ?? null,
      })),
    };
  }
}
