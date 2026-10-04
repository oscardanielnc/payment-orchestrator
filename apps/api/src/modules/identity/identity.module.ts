import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfig } from '../../config/app-config';
import { ApiKeyEnvironment } from './application/ports/api-key-environment';
import { ApiKeySecrets } from './application/ports/api-key-secrets';
import { ApiKeyRepository } from './application/ports/api-key.repository';
import {
  AccessTokens,
  AuthSettings,
  OpaqueTokenSecrets,
  PasswordHasher,
  SessionRepository,
  UserRepository,
} from './application/ports/auth-ports';
import { OrganizationRepository } from './application/ports/organization.repository';
import { ApiKeyIssuer } from './application/services/api-key-issuer';
import { SessionIssuer } from './application/services/session-issuer';
import { AuthenticateAccessTokenUseCase } from './application/use-cases/authenticate-access-token.use-case';
import { AuthenticateApiKeyUseCase } from './application/use-cases/authenticate-api-key.use-case';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetOrganizationUseCase } from './application/use-cases/get-organization.use-case';
import { IssueApiKeyUseCase } from './application/use-cases/issue-api-key.use-case';
import { ListApiKeysUseCase } from './application/use-cases/list-api-keys.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RevokeApiKeyUseCase } from './application/use-cases/revoke-api-key.use-case';
import { Argon2PasswordHasher, NodeOpaqueTokenSecrets } from './infrastructure/crypto/auth-crypto';
import { JwtAccessTokens } from './infrastructure/crypto/jwt-access-tokens';
import { NodeApiKeySecrets } from './infrastructure/crypto/node-api-key-secrets';
import { PrismaApiKeyRepository } from './infrastructure/persistence/prisma/prisma-api-key.repository';
import {
  PrismaSessionRepository,
  PrismaUserRepository,
} from './infrastructure/persistence/prisma/prisma-auth.repositories';
import { PrismaOrganizationRepository } from './infrastructure/persistence/prisma/prisma-organization.repository';
import { ApiKeysController } from './presentation/http/api-keys.controller';
import { AuthController } from './presentation/http/auth.controller';
import { MerchantAuthGuard } from './presentation/http/merchant-auth.guard';
import { OrganizationController } from './presentation/http/organization.controller';
import { RolesGuard } from './presentation/http/roles.guard';

@Module({
  imports: [
    JwtModule.register({}),
    // Brute-force protection for login and refresh (applied per route with ThrottlerGuard).
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => [
        { ttl: 60_000, limit: config.auth.loginRateLimitPerMinute },
      ],
    }),
  ],
  controllers: [OrganizationController, ApiKeysController, AuthController],
  providers: [
    // Ports → adapters: the only place that knows which implementation runs.
    { provide: OrganizationRepository, useClass: PrismaOrganizationRepository },
    { provide: ApiKeyRepository, useClass: PrismaApiKeyRepository },
    { provide: ApiKeySecrets, useClass: NodeApiKeySecrets },
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: SessionRepository, useClass: PrismaSessionRepository },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: OpaqueTokenSecrets, useClass: NodeOpaqueTokenSecrets },
    { provide: AccessTokens, useClass: JwtAccessTokens },
    {
      provide: ApiKeyEnvironment,
      useFactory: (config: AppConfig): ApiKeyEnvironment => ({ tag: config.paymentsMode }),
      inject: [AppConfig],
    },
    {
      provide: AuthSettings,
      useFactory: (config: AppConfig): AuthSettings => ({
        refreshTokenTtlDays: config.auth.refreshTokenTtlDays,
      }),
      inject: [AppConfig],
    },
    ApiKeyIssuer,
    SessionIssuer,
    CreateOrganizationUseCase,
    IssueApiKeyUseCase,
    RevokeApiKeyUseCase,
    AuthenticateApiKeyUseCase,
    AuthenticateAccessTokenUseCase,
    GetOrganizationUseCase,
    ListApiKeysUseCase,
    CreateUserUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    MerchantAuthGuard,
    RolesGuard,
  ],
  // Public API of the module (other modules use these, never the repositories).
  exports: [
    MerchantAuthGuard,
    RolesGuard,
    AuthenticateApiKeyUseCase,
    AuthenticateAccessTokenUseCase,
    CreateOrganizationUseCase,
    CreateUserUseCase,
    IssueApiKeyUseCase,
    RevokeApiKeyUseCase,
  ],
})
export class IdentityModule {}
