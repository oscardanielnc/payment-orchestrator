export interface StoredResponse {
  statusCode: number;
  body: unknown;
}

export type ClaimResult =
  { outcome: 'claimed' } | { outcome: 'replay'; requestHash: string; response: StoredResponse };

/**
 * Idempotency keys (ADR 0007). Used inside one transaction that also contains the
 * work: claim → do the work → complete. If anything fails, the rollback frees the key.
 */
export abstract class IdempotencyStore {
  /**
   * Reserves the key. A concurrent request with the same key waits on the unique index
   * until the first transaction ends, then receives its stored response.
   */
  abstract claim(scope: string, key: string, requestHash: string): Promise<ClaimResult>;
  abstract complete(scope: string, key: string, response: StoredResponse): Promise<void>;
}
