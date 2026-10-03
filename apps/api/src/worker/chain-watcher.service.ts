import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { CryptoNetworks } from '../modules/crypto/application/ports/crypto-networks';
import type { CryptoNetwork } from '../modules/crypto/domain/network';
import { ProcessChainTransfersUseCase } from '../modules/payments/application/use-cases/process-chain-transfers.use-case';

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
    private readonly process: ProcessChainTransfersUseCase,
    private readonly config: AppConfig,
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
    try {
      const summary = await this.process.execute(network);
      // Re-read transfers (cursor overlap) are expected; only log when something new happened.
      if (summary.applied > 0) {
        this.logger.log(
          `${network}: ${summary.applied} new transfer(s), ${summary.paid} charge(s) paid`,
        );
      }
    } catch (error) {
      this.logger.error(`${network} tick failed; retrying next interval`, error as Error);
    } finally {
      this.schedule(network, this.config.tron?.pollIntervalMs ?? 10_000);
    }
  }
}
