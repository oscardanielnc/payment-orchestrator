import type { Env } from './env.schema';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string | undefined;
}

export interface TronConfig {
  fullHost: string;
  apiKey: string | undefined;
  usdtContract: string | undefined;
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
  ) {}

  static fromEnv(env: Env): AppConfig {
    return new AppConfig(
      env.NODE_ENV,
      env.API_PORT,
      env.PAYMENTS_MODE,
      env.DATABASE_URL,
      env.REDIS_URL,
      env.STRIPE_SECRET_KEY
        ? { secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET }
        : undefined,
      env.TRON_FULL_HOST
        ? {
            fullHost: env.TRON_FULL_HOST,
            apiKey: env.TRONGRID_API_KEY,
            usdtContract: env.TRON_USDT_CONTRACT,
          }
        : undefined,
      env.BASE_SEPOLIA_RPC_URL && env.BASE_SEPOLIA_CHAIN_ID
        ? {
            rpcUrl: env.BASE_SEPOLIA_RPC_URL,
            chainId: env.BASE_SEPOLIA_CHAIN_ID,
            usdcContract: env.BASE_USDC_CONTRACT,
          }
        : undefined,
    );
  }
}
