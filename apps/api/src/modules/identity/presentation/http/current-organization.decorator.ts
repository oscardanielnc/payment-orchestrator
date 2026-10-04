import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Principal } from '../../application/principal';
import { UnauthenticatedError } from '../../domain/errors';
import type { AuthenticatedRequest } from './merchant-auth.guard';

const principalOf = (context: ExecutionContext): Principal => {
  const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
  if (!principal) throw new UnauthenticatedError();
  return principal;
};

/** Organization id of the authenticated caller. Only valid behind `MerchantAuthGuard`. */
export const CurrentOrganization = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => principalOf(context).organizationId,
);

/** The whole principal (organization + who: API key or user). */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => principalOf(context),
);
