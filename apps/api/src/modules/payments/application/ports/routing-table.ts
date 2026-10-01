import type { PaymentRoute } from '../../domain/payment-route';

/** Which provider handles which method and currencies. Data, not code branches. */
export abstract class RoutingTable {
  abstract routes(): readonly PaymentRoute[];
}
