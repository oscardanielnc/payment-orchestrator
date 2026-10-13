import { TransferBatch, TransferSource } from '../../application/ports/transfer-source';
import type { ChainTransfer } from '../../domain/chain-transfer';
import type { CryptoNetwork } from '../../domain/network';
import { tronAddressToHex20 } from './tron-address';

interface TronGridEvent {
  transaction_id: string;
  event_index: number;
  block_number: number;
  block_timestamp: number;
  result: { from: string; to: string; value: string };
}

interface TronGridPage {
  data?: TronGridEvent[];
  meta?: { fingerprint?: string };
}

const PAGE_SIZE = 200;
const MAX_PAGES_PER_POLL = 20;
const REQUEST_TIMEOUT_MS = 10_000;
/** First run starts a little in the past instead of scanning the token's whole history. */
const FIRST_RUN_LOOKBACK_MS = 10 * 60 * 1000;
/** Re-read this much before the cursor, in case the indexer published an event late. */
const OVERLAP_MS = 60 * 1000;

/**
 * TronGrid event API, `only_confirmed=true`: only events in solidified blocks, which TRON
 * guarantees will never be reverted. The cursor is the newest block timestamp already read;
 * the next poll re-reads from that millisecond and duplicates are dropped downstream.
 */
export class TronGridTransferSource extends TransferSource {
  readonly network: CryptoNetwork = 'tron-nile';

  constructor(
    private readonly options: {
      fullHost: string;
      usdtContract: string;
      apiKey: string | undefined;
      pollIntervalMs: number;
      now?: () => number;
    },
  ) {
    super();
  }

  get pollIntervalMs(): number {
    return this.options.pollIntervalMs;
  }

  async fetchConfirmedSince(cursor: string | null): Promise<TransferBatch> {
    const now = this.options.now ?? Date.now;
    const since = cursor ? Number(cursor) - OVERLAP_MS : now() - FIRST_RUN_LOOKBACK_MS;
    let url: string | null = this.firstPageUrl(since);
    let newest = cursor ? Number(cursor) : since;
    const transfers: ChainTransfer[] = [];

    for (let page = 0; url && page < MAX_PAGES_PER_POLL; page += 1) {
      const body = await this.get(url);
      for (const event of body.data ?? []) {
        transfers.push(this.toTransfer(event));
        newest = Math.max(newest, event.block_timestamp);
      }
      const fingerprint = body.meta?.fingerprint;
      url =
        fingerprint && body.data?.length === PAGE_SIZE
          ? `${this.firstPageUrl(since)}&fingerprint=${fingerprint}`
          : null;
    }
    return { transfers, cursor: String(newest), behind: url !== null };
  }

  /** TRC-20 `balanceOf` as a read-only contract call (no transaction, no fee). */
  async tokenBalance(address: string): Promise<bigint> {
    const response = await fetch(`${this.options.fullHost}/wallet/triggerconstantcontract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.options.apiKey && { 'TRON-PRO-API-KEY': this.options.apiKey }),
      },
      body: JSON.stringify({
        owner_address: address,
        contract_address: this.options.usdtContract,
        function_selector: 'balanceOf(address)',
        parameter: tronAddressToHex20(address).padStart(64, '0'),
        visible: true,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`TronGrid answered ${response.status}`);
    const body = (await response.json()) as { constant_result?: string[] };
    const result = body.constant_result?.[0];
    if (!result) throw new Error(`No balance returned for ${address}`);
    return BigInt(`0x${result}`);
  }

  private firstPageUrl(sinceMs: number): string {
    const params = new URLSearchParams({
      event_name: 'Transfer',
      only_confirmed: 'true',
      order_by: 'block_timestamp,asc',
      limit: String(PAGE_SIZE),
      min_block_timestamp: String(sinceMs),
    });
    return `${this.options.fullHost}/v1/contracts/${this.options.usdtContract}/events?${params.toString()}`;
  }

  private async get(url: string): Promise<TronGridPage> {
    const response = await fetch(url, {
      headers: this.options.apiKey ? { 'TRON-PRO-API-KEY': this.options.apiKey } : {},
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`TronGrid answered ${response.status}`);
    return (await response.json()) as TronGridPage;
  }

  private toTransfer(event: TronGridEvent): ChainTransfer {
    return {
      network: this.network,
      txHash: event.transaction_id,
      eventIndex: event.event_index,
      toMatchKey: stripHexPrefix(event.result.to),
      fromMatchKey: stripHexPrefix(event.result.from),
      amount: BigInt(event.result.value),
      blockNumber: BigInt(event.block_number),
      blockTimestamp: new Date(event.block_timestamp),
    };
  }
}

/** TronGrid gives "0x" + 20 bytes; our match key is the bare lowercase hex. */
function stripHexPrefix(value: string): string {
  return value
    .toLowerCase()
    .replace(/^0x/, '')
    .replace(/^41(?=[0-9a-f]{40}$)/, '');
}
