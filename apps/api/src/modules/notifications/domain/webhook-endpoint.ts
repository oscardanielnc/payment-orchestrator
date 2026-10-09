import { InvalidWebhookUrlError } from './errors';

export interface WebhookEndpointProps {
  id: string;
  organizationId: string;
  url: string;
  /** The signing secret, encrypted at rest. Only the cipher adapter can open it. */
  secretCiphertext: string;
  createdAt: Date;
  disabledAt: Date | null;
}

/** Hosts a webhook may never target: the server's own network (SSRF). */
const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * HTTPS only, no credentials in the URL, no private IP literals. `allowLocalHttp` lets local
 * development point at http://localhost (the test receiver); production never sets it.
 */
export function validateWebhookUrl(raw: string, allowLocalHttp: boolean): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidWebhookUrlError('not a URL');
  }
  if (raw.length > 2048) throw new InvalidWebhookUrlError('longer than 2048 characters');
  if (url.username || url.password) throw new InvalidWebhookUrlError('credentials are not allowed');

  const local = LOCAL_HOSTS.includes(url.hostname);
  if (local) {
    if (!allowLocalHttp) throw new InvalidWebhookUrlError('local addresses are not allowed');
    return url.toString();
  }
  if (url.protocol !== 'https:') throw new InvalidWebhookUrlError('must use https');
  if (PRIVATE_IPV4.some((range) => range.test(url.hostname)) || url.hostname.startsWith('[')) {
    throw new InvalidWebhookUrlError('private and IP-literal addresses are not allowed');
  }
  return url.toString();
}

/** Where a merchant wants to hear about its charges. */
export class WebhookEndpoint {
  private constructor(private props: WebhookEndpointProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    url: string;
    secretCiphertext: string;
    allowLocalHttp: boolean;
    now: Date;
  }): WebhookEndpoint {
    return new WebhookEndpoint({
      id: input.id,
      organizationId: input.organizationId,
      url: validateWebhookUrl(input.url, input.allowLocalHttp),
      secretCiphertext: input.secretCiphertext,
      createdAt: input.now,
      disabledAt: null,
    });
  }

  static restore(props: WebhookEndpointProps): WebhookEndpoint {
    return new WebhookEndpoint({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get url(): string {
    return this.props.url;
  }
  get secretCiphertext(): string {
    return this.props.secretCiphertext;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get disabledAt(): Date | null {
    return this.props.disabledAt;
  }
  get enabled(): boolean {
    return this.props.disabledAt === null;
  }

  /** Disabling is final and idempotent; pending deliveries to it stop at their next attempt. */
  disable(now: Date): void {
    this.props.disabledAt ??= now;
  }
}
