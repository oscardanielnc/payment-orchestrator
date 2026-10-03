import type { Env } from './env.schema';

/**
 * The only place in the codebase that knows about test vs live (ADR 0006).
 * This repository accepts test mode only. Every rule fails closed: anything not
 * explicitly allowed is rejected.
 */
export const ALLOWED_PAYMENTS_MODE = 'test';
export const TRON_TESTNET_HOSTS = ['https://nile.trongrid.io'];
/** USDT test token on Nile (faucet: nileex.io). */
export const TRON_TESTNET_USDT_CONTRACTS = ['TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'];
export const BASE_SEPOLIA_CHAIN_ID = 84532;

const STRIPE_TEST_KEY = /^(sk|rk)_test_/;

export interface PolicyViolation {
  variable: keyof Env;
  reason: string;
}

export function checkPaymentsPolicy(env: Env): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  if (env.PAYMENTS_MODE !== ALLOWED_PAYMENTS_MODE) {
    violations.push({
      variable: 'PAYMENTS_MODE',
      reason: `must be "${ALLOWED_PAYMENTS_MODE}"; this repository never runs live`,
    });
  }

  if (env.STRIPE_SECRET_KEY !== undefined && !STRIPE_TEST_KEY.test(env.STRIPE_SECRET_KEY)) {
    violations.push({
      variable: 'STRIPE_SECRET_KEY',
      reason: 'must be a Stripe test-mode key (sk_test_ or rk_test_)',
    });
  }

  if (env.STRIPE_SECRET_KEY !== undefined && env.STRIPE_WEBHOOK_SECRET === undefined) {
    violations.push({
      variable: 'STRIPE_WEBHOOK_SECRET',
      reason: 'is required with STRIPE_SECRET_KEY; without it card payments are never confirmed',
    });
  }

  for (const variable of ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'] as const) {
    if (env[variable] !== undefined) {
      violations.push({
        variable,
        reason:
          'Mercado Pago stays disabled until its test-credential rule is decided (feature 12)',
      });
    }
  }

  if (env.TRON_FULL_HOST !== undefined) {
    const origin = new URL(env.TRON_FULL_HOST).origin;
    if (!TRON_TESTNET_HOSTS.includes(origin)) {
      violations.push({
        variable: 'TRON_FULL_HOST',
        reason: `must be a TRON testnet host: ${TRON_TESTNET_HOSTS.join(', ')}`,
      });
    }
  }

  if (
    env.TRON_USDT_CONTRACT !== undefined &&
    !TRON_TESTNET_USDT_CONTRACTS.includes(env.TRON_USDT_CONTRACT)
  ) {
    violations.push({
      variable: 'TRON_USDT_CONTRACT',
      reason: `must be the Nile test USDT contract: ${TRON_TESTNET_USDT_CONTRACTS.join(', ')}`,
    });
  }

  if (env.BASE_SEPOLIA_RPC_URL !== undefined || env.BASE_SEPOLIA_CHAIN_ID !== undefined) {
    if (env.BASE_SEPOLIA_CHAIN_ID !== BASE_SEPOLIA_CHAIN_ID) {
      violations.push({
        variable: 'BASE_SEPOLIA_CHAIN_ID',
        reason: `must be ${BASE_SEPOLIA_CHAIN_ID} (Base Sepolia)`,
      });
    }
  }

  return violations;
}
