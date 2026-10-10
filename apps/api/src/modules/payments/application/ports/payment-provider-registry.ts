import type { ProviderId } from '../../domain/payment-route';
import type { PaymentProvider } from './payment-provider';

/** Providers enabled in this environment. A provider without configuration is not registered. */
export abstract class PaymentProviderRegistry {
  abstract find(id: ProviderId): PaymentProvider | undefined;
  abstract all(): readonly PaymentProvider[];
}
