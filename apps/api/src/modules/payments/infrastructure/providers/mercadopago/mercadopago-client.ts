const API_BASE = 'https://api.mercadopago.com';
const REQUEST_TIMEOUT_MS = 10_000;

export interface MercadoPagoPreferenceRequest {
  items: { id: string; title: string; quantity: 1; unit_price: number; currency_id: string }[];
  /** Our attempt id: the payment carries it back, so a notification finds its attempt. */
  external_reference: string;
  metadata: Record<string, string>;
}

export interface MercadoPagoPreference {
  id: string;
  init_point: string;
}

/** The fields we read from a payment. */
export interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail?: string | null;
  transaction_amount: number;
  currency_id: string;
  external_reference: string | null;
  metadata?: Record<string, unknown> | null;
  date_created?: string;
}

export interface MercadoPagoUser {
  id: number;
  site_id: string;
  tags?: string[];
}

/** The slice of the Mercado Pago REST API this project uses: small enough to fake in tests. */
export interface MercadoPagoApi {
  createPreference(
    request: MercadoPagoPreferenceRequest,
    idempotencyKey: string,
  ): Promise<MercadoPagoPreference>;
  getPayment(id: string): Promise<MercadoPagoPayment>;
  /** Payments filtered by our attempt id, or by creation time for reconciliation. */
  searchPayments(
    filter:
      | { externalReference: string }
      | { createdFrom: Date; createdTo: Date; offset: number; limit: number },
  ): Promise<{ results: MercadoPagoPayment[]; total: number }>;
  me(): Promise<MercadoPagoUser>;
}

/** DI token for the Mercado Pago client (null when Mercado Pago is not configured). */
export const MERCADOPAGO_CLIENT = Symbol('MERCADOPAGO_CLIENT');

/** Plain fetch with a timeout on every call (standard, section 8); no SDK needed for 4 endpoints. */
export class MercadoPagoHttpClient implements MercadoPagoApi {
  constructor(private readonly accessToken: string) {}

  createPreference(
    request: MercadoPagoPreferenceRequest,
    idempotencyKey: string,
  ): Promise<MercadoPagoPreference> {
    return this.call('POST', '/checkout/preferences', request, idempotencyKey);
  }

  getPayment(id: string): Promise<MercadoPagoPayment> {
    return this.call('GET', `/v1/payments/${encodeURIComponent(id)}`);
  }

  async searchPayments(
    filter:
      | { externalReference: string }
      | { createdFrom: Date; createdTo: Date; offset: number; limit: number },
  ): Promise<{ results: MercadoPagoPayment[]; total: number }> {
    const params = new URLSearchParams({ sort: 'date_created', criteria: 'asc' });
    if ('externalReference' in filter) {
      params.set('external_reference', filter.externalReference);
    } else {
      params.set('range', 'date_created');
      params.set('begin_date', filter.createdFrom.toISOString());
      params.set('end_date', filter.createdTo.toISOString());
      params.set('offset', String(filter.offset));
      params.set('limit', String(filter.limit));
    }
    const body = await this.call<{ results?: MercadoPagoPayment[]; paging?: { total?: number } }>(
      'GET',
      `/v1/payments/search?${params.toString()}`,
    );
    const results = body.results ?? [];
    return { results, total: body.paging?.total ?? results.length };
  }

  me(): Promise<MercadoPagoUser> {
    return this.call('GET', '/users/me');
  }

  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(idempotencyKey && { 'X-Idempotency-Key': idempotencyKey }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // Never echo the response body: it can carry payer data.
    if (!response.ok)
      throw new Error(
        `Mercado Pago answered ${response.status} to ${method} ${path.split('?')[0]}`,
      );
    return (await response.json()) as T;
  }
}
