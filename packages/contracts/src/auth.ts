import { z } from 'zod';

export const MemberRole = z.enum(['owner', 'member']);
export type MemberRole = z.infer<typeof MemberRole>;

export const LoginRequest = z.strictObject({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const CurrentUser = z.object({
  id: z.uuid(),
  email: z.string(),
  role: MemberRole,
  organizationId: z.uuid(),
});
export type CurrentUser = z.infer<typeof CurrentUser>;

/** The refresh token travels only in an httpOnly cookie, never in this body. */
export const AccessTokenResponse = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int(),
  user: CurrentUser,
});
export type AccessTokenResponse = z.infer<typeof AccessTokenResponse>;

export const CreateApiKeyRequest = z.strictObject({
  name: z.string().trim().min(1).max(60),
});
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequest>;

export const CreatedApiKey = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  /** Shown once. Store it now: it cannot be retrieved later. */
  token: z.string(),
});
export type CreatedApiKey = z.infer<typeof CreatedApiKey>;
