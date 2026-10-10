import { createPublicClient, http, parseAbiItem } from 'viem';

/** One ERC-20 `Transfer` log, already decoded. */
export interface EvmTransferLog {
  transactionHash: string;
  logIndex: number;
  blockNumber: bigint;
  from: string;
  to: string;
  value: bigint;
  /** Newer nodes include it in the log; otherwise the source asks for the block. */
  blockTimestamp?: Date;
}

/** The JSON-RPC calls the watcher needs: small enough to fake in tests. */
export interface EvmChainReader {
  chainId(): Promise<number>;
  headBlock(): Promise<bigint>;
  transferLogs(token: string, fromBlock: bigint, toBlock: bigint): Promise<EvmTransferLog[]>;
  blockTimestamp(blockNumber: bigint): Promise<Date>;
}

const TRANSFER = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

/** viem over plain JSON-RPC: eth_chainId, eth_blockNumber, eth_getLogs, eth_getBlockByNumber. */
export function viemChainReader(rpcUrl: string): EvmChainReader {
  // Every outbound call has a timeout (standard, section 8); viem retries transient errors.
  const client = createPublicClient({ transport: http(rpcUrl, { timeout: 10_000 }) });
  return {
    chainId: () => client.getChainId(),
    headBlock: () => client.getBlockNumber({ cacheTime: 0 }),
    async transferLogs(token, fromBlock, toBlock) {
      const logs = await client.getLogs({
        address: token as `0x${string}`,
        event: TRANSFER,
        fromBlock,
        toBlock,
        strict: true,
      });
      return logs.map((log) => ({
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
        from: log.args.from,
        to: log.args.to,
        value: log.args.value,
        ...(typeof log.blockTimestamp === 'bigint' && {
          blockTimestamp: new Date(Number(log.blockTimestamp) * 1000),
        }),
      }));
    },
    async blockTimestamp(blockNumber) {
      const block = await client.getBlock({ blockNumber });
      return new Date(Number(block.timestamp) * 1000);
    },
  };
}
