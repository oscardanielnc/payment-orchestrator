import { describe, expect, it } from 'vitest';
import { PAYMENT_ROUTES } from '../infrastructure/routing/payment-routes';
import { UnsupportedPaymentMethodError } from './errors';
import { resolveRoute } from './payment-route';

describe('resolveRoute with the configured table', () => {
  it.each([
    ['card', 'USD', 'stripe'],
    ['card', 'PEN', 'stripe'],
    ['mercadopago', 'PEN', 'mercadopago'],
    ['usdt_tron', 'USDT', 'tron'],
    ['usdc_base', 'USDC', 'base'],
  ] as const)('routes %s in %s to %s', (method, currency, provider) => {
    expect(resolveRoute(PAYMENT_ROUTES, method, currency).provider).toBe(provider);
  });

  it.each([
    ['card', 'USDT'],
    ['usdt_tron', 'USD'],
    ['usdc_base', 'USDT'],
    ['mercadopago', 'USD'],
  ] as const)('rejects %s in %s', (method, currency) => {
    expect(() => resolveRoute(PAYMENT_ROUTES, method, currency)).toThrow(
      UnsupportedPaymentMethodError,
    );
  });
});
