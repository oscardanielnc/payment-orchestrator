import { DepositAddressesService } from '../../../crypto/application/services/deposit-addresses.service';
import type { CryptoNetwork, CryptoToken } from '../../../crypto/domain/network';
import type {
  PaymentProvider,
  ProviderPayment,
  ProviderPaymentRequest,
} from '../../application/ports/payment-provider';
import type { ProviderId } from '../../domain/payment-route';

/**
 * Our own crypto "provider": no processor in between. Paying = sending the exact amount
 * to a fresh address derived for this attempt; the chain watcher confirms it later.
 */
export class CryptoDepositProvider implements PaymentProvider {
  constructor(
    readonly id: ProviderId,
    private readonly network: CryptoNetwork,
    private readonly token: CryptoToken,
    private readonly deposits: DepositAddressesService,
  ) {}

  async createPayment(request: ProviderPaymentRequest): Promise<ProviderPayment> {
    const deposit = await this.deposits.allocate({
      network: this.network,
      attemptId: request.attemptId,
      chargeId: request.chargeId,
      organizationId: request.organizationId,
      expected: request.amount,
    });
    return {
      externalReference: deposit.address,
      instructions: {
        type: 'crypto_transfer',
        network: this.network,
        token: this.token,
        address: deposit.address,
        amount: request.amount.toMinorUnits(),
      },
    };
  }
}
