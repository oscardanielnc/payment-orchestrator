import { TransferBatch, TransferSource } from '../../application/ports/transfer-source';
import type { ChainTransfer } from '../../domain/chain-transfer';
import type { CryptoNetwork } from '../../domain/network';
import {
  type EvmChainReader,
  type EvmTransferLog,
  LogRangeTooLargeError,
} from './evm-chain-reader';

/** sepolia.base.org caps eth_getLogs at 200 blocks (about 7 minutes on Base). */
const BLOCKS_PER_REQUEST = 200n;
const REQUESTS_PER_POLL = 10n;
/** First run starts a little in the past instead of scanning the whole token history. */
const FIRST_RUN_LOOKBACK_BLOCKS = 300n;

/**
 * ERC-20 `Transfer` logs of one token, read only up to `head - confirmations` (ADR 0020):
 * a block that deep is treated as final. The cursor is the last block read and the next
 * poll starts right after it, so nothing is skipped or read twice in normal operation.
 */
export class EvmTransferSource extends TransferSource {
  private chainChecked = false;

  constructor(
    readonly network: CryptoNetwork,
    private readonly options: {
      reader: EvmChainReader;
      token: string;
      expectedChainId: number;
      confirmations: number;
      pollIntervalMs: number;
    },
  ) {
    super();
  }

  get pollIntervalMs(): number {
    return this.options.pollIntervalMs;
  }

  async fetchConfirmedSince(cursor: string | null): Promise<TransferBatch> {
    const { reader } = this.options;
    await this.ensureExpectedChain();

    const confirmedHead = (await reader.headBlock()) - BigInt(this.options.confirmations);
    const from = cursor ? BigInt(cursor) + 1n : confirmedHead - FIRST_RUN_LOOKBACK_BLOCKS;
    if (from > confirmedHead) return { transfers: [], cursor: cursor ?? String(confirmedHead) };

    const last = min(confirmedHead, from + BLOCKS_PER_REQUEST * REQUESTS_PER_POLL - 1n);

    const logs: EvmTransferLog[] = [];
    for (let start = from; start <= last; start += BLOCKS_PER_REQUEST) {
      const end = min(last, start + BLOCKS_PER_REQUEST - 1n);
      logs.push(...(await this.readLogs(start, end)));
    }

    // Most token transfers are not ours: ask for a block only when the log lacks its time.
    const timestamps = new Map<bigint, Date>();
    for (const log of logs) {
      if (log.blockTimestamp) timestamps.set(log.blockNumber, log.blockTimestamp);
    }
    for (const block of new Set(logs.map((l) => l.blockNumber))) {
      if (!timestamps.has(block)) timestamps.set(block, await reader.blockTimestamp(block));
    }

    const transfers: ChainTransfer[] = logs.map((log) => ({
      network: this.network,
      txHash: log.transactionHash.toLowerCase(),
      eventIndex: log.logIndex,
      toMatchKey: bareHex(log.to),
      fromMatchKey: bareHex(log.from),
      amount: log.value,
      blockNumber: log.blockNumber,
      blockTimestamp: timestamps.get(log.blockNumber) ?? new Date(0),
    }));
    return { transfers, cursor: String(last), behind: last < confirmedHead };
  }

  /**
   * A busy stretch of the token can answer more than the node or viem accept for one range;
   * halving it until it fits keeps the cursor moving instead of failing the same poll forever.
   */
  private async readLogs(from: bigint, to: bigint): Promise<EvmTransferLog[]> {
    try {
      return await this.options.reader.transferLogs(this.options.token, from, to);
    } catch (error) {
      if (!(error instanceof LogRangeTooLargeError) || from === to) throw error;
      const middle = from + (to - from) / 2n;
      return [...(await this.readLogs(from, middle)), ...(await this.readLogs(middle + 1n, to))];
    }
  }

  async tokenBalance(address: string): Promise<bigint> {
    await this.ensureExpectedChain();
    return this.options.reader.tokenBalance(this.options.token, address);
  }

  /** The policy checks the configured chain id; this checks the RPC really serves that chain. */
  private async ensureExpectedChain(): Promise<void> {
    if (this.chainChecked) return;
    const actual = await this.options.reader.chainId();
    if (actual !== this.options.expectedChainId) {
      throw new Error(
        `RPC serves chain ${actual}, expected ${this.options.expectedChainId}; refusing to watch it`,
      );
    }
    this.chainChecked = true;
  }
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const bareHex = (address: string) => address.toLowerCase().replace(/^0x/, '');
