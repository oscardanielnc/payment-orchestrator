import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { type CreatedApiKey, CreateApiKeyRequest } from '@po/contracts';
import { IdempotencyInterceptor } from '../../../../shared/presentation/http/idempotency.interceptor';
import { ZodValidationPipe } from '../../../../shared/presentation/http/zod-validation.pipe';
import { ApiKeyEnvironment } from '../../application/ports/api-key-environment';
import { IssueApiKeyUseCase } from '../../application/use-cases/issue-api-key.use-case';
import { ListApiKeysUseCase } from '../../application/use-cases/list-api-keys.use-case';
import { RevokeApiKeyUseCase } from '../../application/use-cases/revoke-api-key.use-case';
import { ApiKeyToken } from '../../domain/api-key-token';
import { CurrentOrganization } from './current-organization.decorator';
import { MerchantAuthGuard } from './merchant-auth.guard';
import { Roles, RolesGuard } from './roles.guard';

@Controller('api-keys')
@UseGuards(MerchantAuthGuard, RolesGuard)
export class ApiKeysController {
  constructor(
    private readonly listApiKeys: ListApiKeysUseCase,
    private readonly issueApiKey: IssueApiKeyUseCase,
    private readonly revokeApiKey: RevokeApiKeyUseCase,
    private readonly environment: ApiKeyEnvironment,
  ) {}

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

  /** Owners only, signed in: a leaked API key cannot mint more keys. */
  @Post()
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @CurrentOrganization() organizationId: string,
    @Body(new ZodValidationPipe(CreateApiKeyRequest)) body: CreateApiKeyRequest,
  ): Promise<CreatedApiKey> {
    const { apiKeyId, token } = await this.issueApiKey.execute({ organizationId, name: body.name });
    return {
      id: apiKeyId,
      name: body.name,
      prefix: ApiKeyToken.displayPrefix(this.environment.tag, apiKeyId),
      token,
    };
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@CurrentOrganization() organizationId: string, @Param('id') apiKeyId: string) {
    await this.revokeApiKey.execute({ organizationId, apiKeyId });
  }
}
