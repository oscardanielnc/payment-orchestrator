import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { ApiKeyEnvironment } from './application/ports/api-key-environment';
import { ApiKeySecrets } from './application/ports/api-key-secrets';
import { ApiKeyRepository } from './application/ports/api-key.repository';
import { OrganizationRepository } from './application/ports/organization.repository';
import { ApiKeyIssuer } from './application/services/api-key-issuer';
import { AuthenticateApiKeyUseCase } from './application/use-cases/authenticate-api-key.use-case';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization.use-case';
import { GetOrganizationUseCase } from './application/use-cases/get-organization.use-case';
import { IssueApiKeyUseCase } from './application/use-cases/issue-api-key.use-case';
import { ListApiKeysUseCase } from './application/use-cases/list-api-keys.use-case';
import { RevokeApiKeyUseCase } from './application/use-cases/revoke-api-key.use-case';
import { NodeApiKeySecrets } from './infrastructure/crypto/node-api-key-secrets';
import { PrismaApiKeyRepository } from './infrastructure/persistence/prisma/prisma-api-key.repository';
import { PrismaOrganizationRepository } from './infrastructure/persistence/prisma/prisma-organization.repository';
import { ApiKeyGuard } from './presentation/http/api-key.guard';
import { ApiKeysController } from './presentation/http/api-keys.controller';
import { OrganizationController } from './presentation/http/organization.controller';

@Module({
  controllers: [OrganizationController, ApiKeysController],
  providers: [
    // Ports → adapters: the only place that knows which implementation runs.
    { provide: OrganizationRepository, useClass: PrismaOrganizationRepository },
    { provide: ApiKeyRepository, useClass: PrismaApiKeyRepository },
    { provide: ApiKeySecrets, useClass: NodeApiKeySecrets },
    {
      provide: ApiKeyEnvironment,
      useFactory: (config: AppConfig): ApiKeyEnvironment => ({ tag: config.paymentsMode }),
      inject: [AppConfig],
    },
    ApiKeyIssuer,
    CreateOrganizationUseCase,
    IssueApiKeyUseCase,
    RevokeApiKeyUseCase,
    AuthenticateApiKeyUseCase,
    GetOrganizationUseCase,
    ListApiKeysUseCase,
    ApiKeyGuard,
  ],
  // Public API of the module (other modules use these, never the repositories).
  exports: [
    ApiKeyGuard,
    AuthenticateApiKeyUseCase,
    CreateOrganizationUseCase,
    IssueApiKeyUseCase,
    RevokeApiKeyUseCase,
  ],
})
export class IdentityModule {}
