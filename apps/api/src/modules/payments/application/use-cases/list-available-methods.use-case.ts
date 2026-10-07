import { Injectable } from '@nestjs/common';
import type { PaymentMethod } from '../../domain/payment-route';
import { PaymentProviderRegistry } from '../ports/payment-provider-registry';
import { RoutingTable } from '../ports/routing-table';

/** Methods a customer can use for this currency here: routed, and with the provider enabled. */
@Injectable()
export class ListAvailableMethodsUseCase {
  constructor(
    private readonly routing: RoutingTable,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  execute(currency: string): PaymentMethod[] {
    return this.routing
      .routes()
      .filter((route) => route.currencies.includes(currency))
      .filter((route) => this.providers.find(route.provider) !== undefined)
      .map((route) => route.method);
  }
}
