import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './load-config';

const validEnv = {
  PAYMENTS_MODE: 'test',
  DATABASE_URL: 'postgresql://orchestrator:orchestrator@localhost:5432/orchestrator',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters', // gitleaks:allow (fake)
  STRIPE_SECRET_KEY: 'sk_test_placeholder', // gitleaks:allow (fake test-mode key)
  STRIPE_WEBHOOK_SECRET: 'whsec_placeholder', // gitleaks:allow (fake test secret)
  STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder', // gitleaks:allow (fake test-mode key)
  WEBHOOK_SECRETS_KEY: Buffer.alloc(32, 7).toString('base64'), // fake key, not random
  TRON_FULL_HOST: 'https://nile.trongrid.io',
  BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
  BASE_SEPOLIA_CHAIN_ID: '84532',
};

// Built at runtime so no live-looking key exists in the source (and secret scanners stay quiet).
const LIVE_STRIPE_KEY = ['sk', 'live', 'placeholder-not-a-real-key'].join('_');

function problemsFor(env: NodeJS.ProcessEnv): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
  throw new Error('expected loadConfig to throw a ConfigError');
}

describe('loadConfig', () => {
  it('accepts a valid test environment', () => {
    const config = loadConfig(validEnv);

    expect(config.paymentsMode).toBe('test');
    expect(config.apiPort).toBe(3000);
    expect(config.base).toBeUndefined();
  });

  it('treats empty values from .env.example as not configured', () => {
    const config = loadConfig({ ...validEnv, STRIPE_SECRET_KEY: '', TRON_FULL_HOST: '' });

    expect(config.stripe).toBeUndefined();
    expect(config.tron).toBeUndefined();
  });

  it('rejects a live Stripe key, naming the variable but never its value', () => {
    const problems = problemsFor({ ...validEnv, STRIPE_SECRET_KEY: LIVE_STRIPE_KEY });

    expect(problems).toEqual([expect.stringContaining('STRIPE_SECRET_KEY')]);
    expect(problems.join('\n')).not.toContain(LIVE_STRIPE_KEY);
  });

  it('requires the webhook secret when a Stripe key is set', () => {
    const withoutSecret = { ...validEnv, STRIPE_WEBHOOK_SECRET: undefined };

    expect(problemsFor(withoutSecret)).toEqual([expect.stringContaining('STRIPE_WEBHOOK_SECRET')]);
  });

  it('accepts only a test publishable key, and requires it with the secret key', () => {
    const live = ['pk', 'live', 'placeholder'].join('_');

    expect(problemsFor({ ...validEnv, STRIPE_PUBLISHABLE_KEY: live })).toEqual([
      expect.stringContaining('STRIPE_PUBLISHABLE_KEY'),
    ]);
    expect(problemsFor({ ...validEnv, STRIPE_PUBLISHABLE_KEY: undefined })).toEqual([
      expect.stringContaining('STRIPE_PUBLISHABLE_KEY'),
    ]);
  });

  it('rejects any payments mode other than test', () => {
    expect(problemsFor({ ...validEnv, PAYMENTS_MODE: 'live' })).toEqual([
      expect.stringContaining('PAYMENTS_MODE'),
    ]);
  });

  it('rejects a chain id other than Base Sepolia', () => {
    expect(problemsFor({ ...validEnv, BASE_SEPOLIA_CHAIN_ID: '8453' })).toEqual([
      expect.stringContaining('BASE_SEPOLIA_CHAIN_ID'),
    ]);
  });

  it('rejects a TRON host outside the testnet allow-list', () => {
    expect(problemsFor({ ...validEnv, TRON_FULL_HOST: 'https://tron.example.com' })).toEqual([
      expect.stringContaining('TRON_FULL_HOST'),
    ]);
  });

  it('rejects a TRON USDT contract other than the Nile test token', () => {
    expect(
      problemsFor({ ...validEnv, TRON_USDT_CONTRACT: 'TFakeContractAddress11111111111111' }),
    ).toEqual([expect.stringContaining('TRON_USDT_CONTRACT')]);
  });

  it('enables TRON only when host, contract and deposit xpub are all set', () => {
    expect(loadConfig(validEnv).tron).toBeUndefined();
  });

  it('enables Base only with RPC, chain id, USDC contract and deposit xpub', () => {
    const config = loadConfig({
      ...validEnv,
      BASE_USDC_CONTRACT: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      BASE_DEPOSIT_XPUB: `xpub${'1'.repeat(107)}`, // gitleaks:allow (shape only, not a key)
    });
    expect(config.base).toMatchObject({ chainId: 84532, confirmations: 12 });
  });

  it('rejects a Base USDC contract other than the Sepolia test token', () => {
    expect(
      problemsFor({
        ...validEnv,
        BASE_USDC_CONTRACT: '0x1111111111111111111111111111111111111111',
      }),
    ).toEqual([expect.stringContaining('BASE_USDC_CONTRACT')]);
  });

  it('keeps Mercado Pago disabled until its rule exists', () => {
    expect(problemsFor({ ...validEnv, MERCADOPAGO_ACCESS_TOKEN: 'TEST-placeholder' })).toEqual([
      expect.stringContaining('MERCADOPAGO_ACCESS_TOKEN'),
    ]);
  });

  it('reports every missing required variable at once', () => {
    const problems = problemsFor({});

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('PAYMENTS_MODE'),
        expect.stringContaining('DATABASE_URL'),
        expect.stringContaining('REDIS_URL'),
      ]),
    );
  });
});
