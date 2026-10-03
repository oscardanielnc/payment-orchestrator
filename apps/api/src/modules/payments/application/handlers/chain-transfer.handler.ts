import { Logger } from '@nestjs/common';
import { chainTransferCodec } from '../../../crypto/application/services/chain-transfer.codec';
import type { CryptoNetwork } from '../../../crypto/domain/network';
import { InboundEventHandler } from '../../../inbound/application/ports/inbound-ports';
import type { InboundEvent } from '../../../inbound/domain/inbound-event';
import type { SettleChainTransferUseCase } from '../use-cases/settle-chain-transfer.use-case';

/** Consumes `chain.transfer` inbound events of one network from the queue. */
export class ChainTransferHandler extends InboundEventHandler {
  private readonly logger = new Logger(ChainTransferHandler.name);

  constructor(
    readonly provider: CryptoNetwork,
    private readonly settle: SettleChainTransferUseCase,
  ) {
    super();
  }

  async handle(event: InboundEvent): Promise<void> {
    const result = await this.settle.execute(chainTransferCodec.decode(event.payload));
    if (result.applied) {
      this.logger.log(
        `${this.provider}: transfer ${event.externalId} applied${result.paid ? ', charge paid' : ''}`,
      );
    }
  }
}
