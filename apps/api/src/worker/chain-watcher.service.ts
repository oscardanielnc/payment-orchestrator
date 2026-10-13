import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { CryptoNetworks } from '../modules/crypto/application/ports/crypto-networks';
import type { CryptoNetwork } from '../modules/crypto/domain/network';
import { IngestChainTransfersUseCase } from '../modules/payments/application/use-cases/ingest-chain-transfers.use-case';

/** Short pause between catch-up reads, to stay under public RPC rate limits. */
const CATCH_UP_DELAY_MS = 500;

/**
 * Polls every configured network. Ticks never overlap (the next one is scheduled after the
 * current one ends) and an error in one tick is logged and retried on the next.
 */
@Injectable()
export class ChainWatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ChainWatcherService.name);
  private readonly timers = new Map<CryptoNetwork, NodeJS.Timeout>();
  private stopped = false;

  constructor(
    private readonly networks: CryptoNetworks,
    private readonly ingest: IngestChainTransfersUseCase,
  ) {}

  onApplicationBootstrap(): void {
    const networks = this.networks.enabled();
    if (networks.length === 0) this.logger.warn('No crypto network configured; nothing to watch');
    for (const network of networks) {
      this.logger.log(`Watching ${network}`);
      this.schedule(network, 0);
    }
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
  }

  private schedule(network: CryptoNetwork, delayMs: number): void {
    if (this.stopped) return;
    this.timers.set(
      network,
      setTimeout(() => void this.tick(network), delayMs),
    );
  }

  private async tick(network: CryptoNetwork): Promise<void> {
    let behind = false;
    try {
      const summary = await this.ingest.execute(network);
      behind = summary.behind === true;
      // Re-read transfers (cursor overlap) are expected; only log when something new arrived.
      if (summary.ingested > 0) {
        this.logger.log(`${network}: ${summary.ingested} new transfer(s) queued for settlement`);
      }
    } catch (error) {
      this.logger.error(`${network} tick failed; retrying next interval`, error as Error);
    } finally {
      // After downtime the chain is far ahead: keep reading right away until caught up.
      this.schedule(
        network,
        behind ? CATCH_UP_DELAY_MS : this.networks.source(network).pollIntervalMs,
      );
    }
  }
}
