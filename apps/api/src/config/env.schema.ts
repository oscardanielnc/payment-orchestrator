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
  /** Attempts per job before it goes to the dead-letter queue. */
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  /** First retry delay; doubles on every attempt (exponential backoff). */
  QUEUE_BACKOFF_MS: z.coerce.number().int().min(1).default(1000),
  /** Redis key prefix: separates environments (and parallel test runs) sharing one Redis. */
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default('po'),

  /** Signs dashboard access tokens (HS256). At least 32 random characters. */
  JWT_ACCESS_SECRET: z.string({ error: 'is required' }).min(32, 'must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(5),
  /** Comma-separated origins allowed to call the API from a browser (the dashboard). */
  DASHBOARD_ORIGINS: z.string().default('http://localhost:5173'),
  /** AES-256-GCM key for webhook signing secrets at rest: 32 random bytes, base64. */
  WEBHOOK_SECRETS_KEY: z
    .string({ error: 'is required' })
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes in base64'),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(8),
  /** First webhook retry delay; doubles each attempt. */
  WEBHOOK_BACKOFF_MS: z.coerce.number().int().min(1).default(30_000),
  /** Public checkout page; a charge's checkoutUrl is this plus its checkout token. */
  CHECKOUT_BASE_URL: z
    .url({ protocol: /^https?$/, error: 'must be an http(s) URL' })
    .default('http://localhost:5173/pay'),

  STRIPE_SECRET_KEY: optional(z.string()),
  /** Public key for Stripe.js in the checkout (pk_test_). Not a secret, but still test-only. */
  STRIPE_PUBLISHABLE_KEY: optional(z.string()),
  STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith('whsec_', 'must start with whsec_')),

  MERCADOPAGO_ACCESS_TOKEN: optional(z.string()),
  MERCADOPAGO_WEBHOOK_SECRET: optional(z.string()),

  TRON_FULL_HOST: optional(z.url({ protocol: /^https$/, error: 'must be an https URL' })),
  TRONGRID_API_KEY: optional(z.string()),
  TRON_USDT_CONTRACT: optional(tronAddress),
  /** Account-level extended PUBLIC key (m/44'/195'/0'): derives one deposit address per attempt. */
  TRON_DEPOSIT_XPUB: optional(
    z.string().regex(/^xpub[1-9A-HJ-NP-Za-km-z]{107}$/, 'must be an xpub'),
  ),
  TRON_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(10_000),

  BASE_SEPOLIA_RPC_URL: optional(z.url({ protocol: /^https$/, error: 'must be an https URL' })),
  BASE_SEPOLIA_CHAIN_ID: optional(z.coerce.number().int()),
  BASE_USDC_CONTRACT: optional(evmAddress),
});

export type Env = z.infer<typeof envSchema>;
