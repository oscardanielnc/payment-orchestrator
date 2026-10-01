import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import type { Money } from '../../../../shared/domain/money';
import { DepositAddress } from '../../domain/deposit-address';
import type { CryptoNetwork } from '../../domain/network';
import { DepositAddressRepository } from '../ports/crypto-repositories';
import { CryptoNetworks } from '../ports/crypto-networks';

/** Public API of the crypto module: hand out a fresh receiving address for a payment attempt. */
@Injectable()
export class DepositAddressesService {
  constructor(
    private readonly networks: CryptoNetworks,
    private readonly deposits: DepositAddressRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async allocate(input: {
    network: CryptoNetwork;
    attemptId: string;
    chargeId: string;
    organizationId: string;
    expected: Money;
  }): Promise<DepositAddress> {
    const deriver = this.networks.deriver(input.network);
    const index = await this.deposits.nextDerivationIndex(input.network);
    const { address, matchKey } = deriver.derive(index);

    const deposit = DepositAddress.create({
      id: this.ids.uuid(),
      network: input.network,
      address,
      matchKey,
      derivationIndex: index,
      attemptId: input.attemptId,
      chargeId: input.chargeId,
      organizationId: input.organizationId,
      expected: input.expected,
      now: this.clock.now(),
    });
    await this.deposits.save(deposit);
    return deposit;
  }
}
