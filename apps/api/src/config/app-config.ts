import type { Env } from './env.schema';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
}

export interface TronConfig {
  fullHost: string;
  apiKey: string | undefined;
  usdtContract: string;
  depositXpub: string;
  pollIntervalMs: number;
}

export interface AuthConfig {
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  loginRateLimitPerMinute: number;
  dashboardOrigins: string[];
}

export interface QueueConfig {
  maxAttempts: number;
  backoffMs: number;
  prefix: string;
}

export interface BaseConfig {
  rpcUrl: string;
  chainId: number;
  usdcContract: string | undefined;
}

/**
 * Validated configuration, injected by class token. Providers are `undefined`
 * when not configured; each adapter decides whether it can run without them.
 */
export class AppConfig {
  constructor(
    readonly nodeEnv: Env['NODE_ENV'],
    readonly apiPort: number,
    readonly paymentsMode: string,
    readonly databaseUrl: string,
    readonly redisUrl: string,
    readonly stripe: StripeConfig | undefined,
    readonly tron: TronConfig | undefined,
    readonly base: BaseConfig | undefined,
    readonly queue: QueueConfig,
    readonly auth: AuthConfig,
    readonly checkoutBaseUrl: string,
  ) {}

  static fromEnv(env: Env): AppConfig {
    return new AppConfig(
      env.NODE_ENV,
      env.API_PORT,
      env.PAYMENTS_MODE,
      env.DATABASE_URL,
      env.REDIS_URL,
      env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PUBLISHABLE_KEY
        ? {
            secretKey: env.STRIPE_SECRET_KEY,
            webhookSecret: env.STRIPE_WEBHOOK_SECRET,
            publishableKey: env.STRIPE_PUBLISHABLE_KEY,
          }
        : undefined,
      // TRON is enabled only when host, token contract and deposit xpub are all configured.
      env.TRON_FULL_HOST && env.TRON_USDT_CONTRACT && env.TRON_DEPOSIT_XPUB
        ? {
            fullHost: env.TRON_FULL_HOST,
            apiKey: env.TRONGRID_API_KEY,
            usdtContract: env.TRON_USDT_CONTRACT,
            depositXpub: env.TRON_DEPOSIT_XPUB,
            pollIntervalMs: env.TRON_POLL_INTERVAL_MS,
          }
        : undefined,
      env.BASE_SEPOLIA_RPC_URL && env.BASE_SEPOLIA_CHAIN_ID
        ? {
            rpcUrl: env.BASE_SEPOLIA_RPC_URL,
            chainId: env.BASE_SEPOLIA_CHAIN_ID,
            usdcContract: env.BASE_USDC_CONTRACT,
          }
        : undefined,
      {
        maxAttempts: env.QUEUE_MAX_ATTEMPTS,
        backoffMs: env.QUEUE_BACKOFF_MS,
        prefix: env.QUEUE_PREFIX,
      },
      {
        accessTokenSecret: env.JWT_ACCESS_SECRET,
        accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
        refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
        loginRateLimitPerMinute: env.LOGIN_RATE_LIMIT_PER_MINUTE,
        dashboardOrigins: env.DASHBOARD_ORIGINS.split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      },
      env.CHECKOUT_BASE_URL.replace(/\/+$/, ''),
    );
  }
}
