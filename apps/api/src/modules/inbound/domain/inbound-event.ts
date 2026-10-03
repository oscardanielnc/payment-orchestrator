export type InboundEventStatus = 'received' | 'processed' | 'ignored' | 'failed';

/** Something that arrived from outside (webhook, chain transfer), stored before any processing. */
export interface InboundEvent {
  id: string;
  /** Who sent it: `stripe`, `tron-nile`... Also selects the handler. */
  provider: string;
  /** The sender's own id: (provider, externalId) is unique, so duplicates are dropped. */
  externalId: string;
  type: string;
  /** Raw body, byte for byte. */
  payload: string;
  status: InboundEventStatus;
  attempts: number;
  lastError: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}

/** What a verifier extracts from a request whose signature is valid. */
export interface VerifiedEvent {
  externalId: string;
  type: string;
}
