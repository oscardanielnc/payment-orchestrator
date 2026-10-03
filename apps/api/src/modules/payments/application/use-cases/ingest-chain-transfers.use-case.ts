import { Injectable } from '@nestjs/common';
import { chainTransferCodec } from '../../../crypto/application/services/chain-transfer.codec';
import { ChainTransfersService } from '../../../crypto/application/services/chain-transfers.service';
import type { CryptoNetwork } from '../../../crypto/domain/network';
import { InboundEventsService } from '../../../inbound/application/services/inbound-events.service';

/**
 * One watcher tick: confirmed transfers to our addresses become inbound events, exactly like
 * provider webhooks (ADR 0008). Settling them happens in the queue, with retries and a
 * dead-letter queue, through `ChainTransferHandler`.
 */
@Injectable()
export class IngestChainTransfersUseCase {
  constructor(
    private readonly chain: ChainTransfersService,
    private readonly inbound: InboundEventsService,
  ) {}

  async execute(network: CryptoNetwork): Promise<{ relevant: number; ingested: number }> {
    const { transfers, cursor } = await this.chain.fetchRelevant(network);
    let ingested = 0;
    for (const transfer of transfers) {
      const { duplicate } = await this.inbound.receive({
        provider: network,
        externalId: chainTransferCodec.externalId(transfer),
        type: 'chain.transfer',
        payload: chainTransferCodec.encode(transfer),
      });
      if (!duplicate) ingested += 1;
    }
    await this.chain.commitCursor(network, cursor);
    return { relevant: transfers.length, ingested };
  }
}
