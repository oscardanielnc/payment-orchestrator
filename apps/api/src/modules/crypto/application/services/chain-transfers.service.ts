import { Injectable } from '@nestjs/common';
import type { ChainTransfer } from '../../domain/chain-transfer';
import type { DepositCredit } from '../../domain/deposit-address';
import type { CryptoNetwork } from '../../domain/network';
import {
  ChainTransferRepository,
  DepositAddressRepository,
  WatcherCursorRepository,
} from '../ports/crypto-repositories';
import { CryptoNetworks } from '../ports/crypto-networks';

/**
 * Public API of the crypto module for watchers. Split in three steps so the caller can
 * keep network calls OUTSIDE database transactions:
 *   fetchRelevant (HTTP, no tx) → applyTransfer (one tx per transfer) → commitCursor
 */
@Injectable()
export class ChainTransfersService {
  constructor(
    private readonly networks: CryptoNetworks,
    private readonly deposits: DepositAddressRepository,
    private readonly transfers: ChainTransferRepository,
    private readonly cursors: WatcherCursorRepository,
  ) {}

  /** New confirmed transfers sent to one of OUR deposit addresses; everything else is ignored. */
  async fetchRelevant(
    network: CryptoNetwork,
  ): Promise<{ transfers: ChainTransfer[]; cursor: string }> {
    const batch = await this.networks
      .source(network)
      .fetchConfirmedSince(await this.cursors.get(network));

    const recipients = [...new Set(batch.transfers.map((t) => t.toMatchKey))];
    const ours = new Set(
      (await this.deposits.findByMatchKeys(network, recipients)).map((d) => d.matchKey),
    );
    return {
      transfers: batch.transfers.filter((t) => ours.has(t.toMatchKey)),
      cursor: batch.cursor,
    };
  }

  /** Records the transfer and credits its deposit. `null` if it was already applied. */
  async applyTransfer(transfer: ChainTransfer): Promise<DepositCredit | null> {
    const deposit = await this.deposits.findByMatchKey(transfer.network, transfer.toMatchKey);
    if (!deposit) return null;
    if (!(await this.transfers.recordIfNew(transfer, deposit.id))) return null;

    const credit = deposit.credit(transfer.amount);
    await this.deposits.save(deposit);
    return credit;
  }

  commitCursor(network: CryptoNetwork, cursor: string): Promise<void> {
    return this.cursors.set(network, cursor);
  }
}
