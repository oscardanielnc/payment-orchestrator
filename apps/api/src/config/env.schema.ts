import { z } from 'zod';

// `.env.example` ships keys with empty values; an empty value means "not configured".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const tronAddress = z
  .string()
  .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, 'must be a base58 TRON address');
const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed EVM address');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PAYMENTS_MODE: z.string({ error: 'is required' }),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
  REDIS_URL: z.url({ protocol: /^rediss?$/, error: 'must be a redis:// URL' }),

  STRIPE_SECRET_KEY: optional(z.string()),
  STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith('whsec_', 'must start with whsec_')),

  MERCADOPAGO_ACCESS_TOKEN: optional(z.string()),
  MERCADOPAGO_WEBHOOK_SECRET: optional(z.string()),

  TRON_FULL_HOST: optional(z.url({ protocol: /^https$/, error: 'must be an https URL' })),
  TRONGRID_API_KEY: optional(z.string()),
  TRON_USDT_CONTRACT: optional(tronAddress),

  BASE_SEPOLIA_RPC_URL: optional(z.url({ protocol: /^https$/, error: 'must be an https URL' })),
  BASE_SEPOLIA_CHAIN_ID: optional(z.coerce.number().int()),
  BASE_USDC_CONTRACT: optional(evmAddress),
});

export type Env = z.infer<typeof envSchema>;
