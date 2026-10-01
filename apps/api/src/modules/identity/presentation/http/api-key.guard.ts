import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiKeyPrincipal,
  AuthenticateApiKeyUseCase,
} from '../../application/use-cases/authenticate-api-key.use-case';
import { InvalidApiKeyError } from '../../domain/errors';

export interface ApiKeyRequest extends Request {
  principal?: ApiKeyPrincipal;
}

/** Accepts `Authorization: Bearer <api key>` and attaches the organization to the request. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateApiKeyUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new InvalidApiKeyError();

    request.principal = await this.authenticate.execute(token);
    return true;
  }
}
