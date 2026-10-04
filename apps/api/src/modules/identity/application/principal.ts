import type { MemberRole } from '../domain/user';

/** Who is calling, after authentication. Every request is scoped by `organizationId`. */
export type Actor =
  { type: 'api_key'; apiKeyId: string } | { type: 'user'; userId: string; role: MemberRole };

export interface Principal {
  organizationId: string;
  actor: Actor;
}
