import type { Env } from './env.schema';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
}

/** Checkout Pro with a test seller's credentials (ADR 0022). */
export interface MercadoPagoConfig {
  accessToken: string;
  webhookSecret: string;
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

export interface WebhooksConfig {
  secretsKey: string;
  maxAttempts: number;
  backoffMs: number;
  /** Endpoints may point at http://localhost outside production (local test receiver). */
  allowLocalHttp: boolean;
}

export interface BaseConfig {
  rpcUrl: string;
  chainId: number;
  usdcContract: string;
  depositXpub: string;
  confirmations: number;
  pollIntervalMs: number;
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
    readonly webhooks: WebhooksConfig,
    readonly mercadopago: MercadoPagoConfig | undefined = undefined,
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
      // Base is enabled only when RPC, chain id, token contract and deposit xpub are all configured.
      env.BASE_SEPOLIA_RPC_URL &&
        env.BASE_SEPOLIA_CHAIN_ID &&
        env.BASE_USDC_CONTRACT &&
        env.BASE_DEPOSIT_XPUB
        ? {
            rpcUrl: env.BASE_SEPOLIA_RPC_URL,
            chainId: env.BASE_SEPOLIA_CHAIN_ID,
            usdcContract: env.BASE_USDC_CONTRACT,
            depositXpub: env.BASE_DEPOSIT_XPUB,
            confirmations: env.BASE_CONFIRMATIONS,
            pollIntervalMs: env.BASE_POLL_INTERVAL_MS,
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
      {
        secretsKey: env.WEBHOOK_SECRETS_KEY,
        maxAttempts: env.WEBHOOK_MAX_ATTEMPTS,
        backoffMs: env.WEBHOOK_BACKOFF_MS,
        allowLocalHttp: env.NODE_ENV !== 'production',
      },
      // Enabled only with both values; the test-user check runs when the payments module starts.
      env.MERCADOPAGO_ACCESS_TOKEN && env.MERCADOPAGO_WEBHOOK_SECRET
        ? {
            accessToken: env.MERCADOPAGO_ACCESS_TOKEN,
            webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET,
          }
        : undefined,
    );
  }
}
