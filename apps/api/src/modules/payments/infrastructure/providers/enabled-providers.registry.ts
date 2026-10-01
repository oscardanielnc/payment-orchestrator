import { Inject, Injectable } from '@nestjs/common';
import type { PaymentProvider } from '../../application/ports/payment-provider';
import { PaymentProviderRegistry } from '../../application/ports/payment-provider-registry';
import type { ProviderId } from '../../domain/payment-route';

/**
 * DI token for the list of provider adapters enabled in this environment. Each provider
 * feature adds its adapter here only when its configuration is present.
 */
export const ENABLED_PAYMENT_PROVIDERS = Symbol('ENABLED_PAYMENT_PROVIDERS');

@Injectable()
export class EnabledProvidersRegistry extends PaymentProviderRegistry {
  private readonly byId: ReadonlyMap<ProviderId, PaymentProvider>;

  constructor(@Inject(ENABLED_PAYMENT_PROVIDERS) providers: PaymentProvider[]) {
    super();
    this.byId = new Map(providers.map((provider) => [provider.id, provider]));
  }

  find(id: ProviderId): PaymentProvider | undefined {
    return this.byId.get(id);
  }
}
