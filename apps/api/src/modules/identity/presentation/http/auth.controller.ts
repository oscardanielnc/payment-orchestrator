import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { type AccessTokenResponse, type CurrentUser, LoginRequest } from '@po/contracts';
import type { CookieOptions, Request, Response } from 'express';
import { ZodValidationPipe } from '../../../../shared/presentation/http/zod-validation.pipe';
import { UserRepository } from '../../application/ports/auth-ports';
import type { Principal } from '../../application/principal';
import type { IssuedTokens } from '../../application/services/session-issuer';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { UnauthenticatedError } from '../../domain/errors';
import type { User } from '../../domain/user';
import { CurrentPrincipal } from './current-organization.decorator';
import { MerchantAuthGuard } from './merchant-auth.guard';

export const REFRESH_COOKIE = 'po_refresh';

/**
 * httpOnly: JavaScript cannot read it (XSS cannot steal it) · Secure: HTTPS only (browsers
 * treat localhost as secure) · SameSite=Lax: not sent on cross-site POSTs (CSRF) ·
 * Path: only travels to the auth endpoints, never to the rest of the API.
 */
const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/v1/auth',
  ...(expires && { expires }),
});

const present = (user: User): CurrentUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  organizationId: user.organizationId,
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshSessionUseCase,
    private readonly logout: LogoutUseCase,
    private readonly users: UserRepository,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  async signIn(
    @Body(new ZodValidationPipe(LoginRequest)) body: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponse> {
    const result = await this.login.execute(body);
    return this.respond(response, result, result.user);
  }

  /** Rotates the refresh cookie and returns a new access token. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  async rotate(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponse> {
    try {
      const result = await this.refresh.execute(this.cookieOf(request));
      return this.respond(response, result, result.user);
    } catch (error) {
      response.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.logout.execute(this.cookieOf(request));
    response.clearCookie(REFRESH_COOKIE, cookieOptions());
  }

  @Get('me')
  @UseGuards(MerchantAuthGuard)
  async me(@CurrentPrincipal() principal: Principal): Promise<CurrentUser> {
    if (principal.actor.type !== 'user') throw new UnauthenticatedError();
    const user = await this.users.findById(principal.actor.userId);
    if (!user) throw new UnauthenticatedError();
    return present(user);
  }

  private respond(response: Response, tokens: IssuedTokens, user: User): AccessTokenResponse {
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(tokens.refreshExpiresAt));
    return {
      accessToken: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: tokens.expiresInSeconds,
      user: present(user),
    };
  }

  private cookieOf(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    return cookies?.[REFRESH_COOKIE];
  }
}
