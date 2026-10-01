import { UnsupportedPaymentMethodError } from './errors';

export type PaymentMethod = 'card' | 'mercadopago' | 'usdt_tron' | 'usdc_base';
export type ProviderId = 'stripe' | 'mercadopago' | 'tron' | 'base';

/** "Payments with this method, in these currencies, are processed by this provider." */
export interface PaymentRoute {
  method: PaymentMethod;
  provider: ProviderId;
  currencies: readonly string[];
}

/** Pure lookup over the configured table: no provider-specific branches anywhere. */
export function resolveRoute(
  routes: readonly PaymentRoute[],
  method: PaymentMethod,
  currency: string,
): PaymentRoute {
  const route = routes.find((r) => r.method === method && r.currencies.includes(currency));
  if (!route) throw new UnsupportedPaymentMethodError(method, currency);
  return route;
}
