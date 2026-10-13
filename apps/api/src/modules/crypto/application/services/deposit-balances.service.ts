import { Injectable } from '@nestjs/common';
import type { CryptoNetwork } from '../../domain/network';
import { CryptoNetworks } from '../ports/crypto-networks';
import { DepositAddressRepository } from '../ports/crypto-repositories';

export interface ChargeDepositBalance {
  chargeId: string;
  organizationId: string;
  currency: string;
  /** Sum of the token balances of every deposit address of the charge, read from the chain. */
  onChain: bigint;
}

/**
 * Public API of the crypto module for reconciliation. Deposits are never swept (ADR 0010),
 * so an address's token balance is everything it ever received: comparable with the ledger.
 */
@Injectable()
export class DepositBalancesService {
  constructor(
    private readonly networks: CryptoNetworks,
    private readonly deposits: DepositAddressRepository,
  ) {}

  async chargesCreatedBetween(network: CryptoNetwork, from: Date, to: Date): Promise<string[]> {
    const deposits = await this.deposits.listCreatedBetween(network, from, to);
    return [...new Set(deposits.map((d) => d.chargeId))];
  }

  async onChainBalances(
    network: CryptoNetwork,
    chargeIds: string[],
  ): Promise<ChargeDepositBalance[]> {
    const source = this.networks.source(network);
    const byCharge = new Map<string, ChargeDepositBalance>();
    // One RPC call per address, in sequence: friendly to public RPC rate limits.
    for (const deposit of await this.deposits.listForCharges(network, chargeIds)) {
      const balance = await source.tokenBalance(deposit.address);
      const current = byCharge.get(deposit.chargeId) ?? {
        chargeId: deposit.chargeId,
        organizationId: deposit.organizationId,
        currency: deposit.expected.currency,
        onChain: 0n,
      };
      byCharge.set(deposit.chargeId, { ...current, onChain: current.onChain + balance });
    }
    return [...byCharge.values()];
  }
}
