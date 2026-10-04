import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError } from '../../domain/errors';
import type { MemberRole } from '../../domain/user';
import type { AuthenticatedRequest } from './merchant-auth.guard';

const ROLES_KEY = 'roles';

/**
 * Only signed-in users with one of these roles. API keys never pass: a leaked key must not be
 * able to manage keys or members. Use after MerchantAuthGuard.
 */
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<MemberRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const actor = context.switchToHttp().getRequest<AuthenticatedRequest>().principal?.actor;
    if (actor?.type !== 'user') throw new ForbiddenError('This action requires a signed-in user');
    if (!roles.includes(actor.role)) {
      throw new ForbiddenError(`This action requires the ${roles.join(' or ')} role`);
    }
    return true;
  }
}
