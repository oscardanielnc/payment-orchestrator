import { Injectable } from '@nestjs/common';
import { RoutingTable } from '../../application/ports/routing-table';
import type { PaymentRoute } from '../../domain/payment-route';

/**
 * The routing table. Adding a provider or a currency is a change here (and an adapter),
 * never an `if` in a use case.
 */
export const PAYMENT_ROUTES: readonly PaymentRoute[] = [
  { method: 'card', provider: 'stripe', currencies: ['USD', 'PEN'] },
  { method: 'mercadopago', provider: 'mercadopago', currencies: ['PEN'] },
  { method: 'usdt_tron', provider: 'tron', currencies: ['USDT'] },
  { method: 'usdc_base', provider: 'base', currencies: ['USDC'] },
];

@Injectable()
export class StaticRoutingTable extends RoutingTable {
  routes(): readonly PaymentRoute[] {
    return PAYMENT_ROUTES;
  }
}
