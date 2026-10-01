import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { InvalidApiKeyError } from '../../domain/errors';
import type { ApiKeyRequest } from './api-key.guard';

/** Organization id of the authenticated caller. Only valid behind `ApiKeyGuard`. */
export const CurrentOrganization = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    if (!request.principal) throw new InvalidApiKeyError();
    return request.principal.organizationId;
  },
);
