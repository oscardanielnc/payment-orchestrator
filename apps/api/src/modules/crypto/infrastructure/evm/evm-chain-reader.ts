import {
  BaseError,
  createPublicClient,
  erc20Abi,
  http,
  LimitExceededRpcError,
  parseAbiItem,
  ResponseBodyTooLargeError,
} from 'viem';

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

/** The node will not answer this many logs at once; a smaller range may work. */
export class LogRangeTooLargeError extends Error {
  constructor(fromBlock: bigint, toBlock: bigint, options?: ErrorOptions) {
    super(`eth_getLogs answer too large for blocks ${fromBlock}-${toBlock}`, options);
    this.name = 'LogRangeTooLargeError';
  }
}

/** The JSON-RPC calls the watcher needs: small enough to fake in tests. */
export interface EvmChainReader {
  chainId(): Promise<number>;
  headBlock(): Promise<bigint>;
  transferLogs(token: string, fromBlock: bigint, toBlock: bigint): Promise<EvmTransferLog[]>;
  blockTimestamp(blockNumber: bigint): Promise<Date>;
  tokenBalance(token: string, address: string): Promise<bigint>;
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
      const logs = await client
        .getLogs({
          address: token as `0x${string}`,
          event: TRANSFER,
          fromBlock,
          toBlock,
          strict: true,
        })
        .catch((error: unknown) => {
          throw isTooManyLogs(error)
            ? new LogRangeTooLargeError(fromBlock, toBlock, { cause: error })
            : error;
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
    tokenBalance: (token, address) =>
      client.readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }),
  };
}

/** A burst of token activity can push 200 blocks of logs past viem's 10 MB body limit. */
function isTooManyLogs(error: unknown): boolean {
  return (
    error instanceof BaseError &&
    Boolean(
      error.walk(
        (e) => e instanceof ResponseBodyTooLargeError || e instanceof LimitExceededRpcError,
      ),
    )
  );
}
