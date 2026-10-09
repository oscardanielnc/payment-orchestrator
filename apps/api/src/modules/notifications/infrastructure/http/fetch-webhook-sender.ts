import { Injectable } from '@nestjs/common';
import { type SendResult, WebhookSender } from '../../application/ports/notification-ports';

const TIMEOUT_MS = 10_000;

/**
 * Plain fetch with a hard timeout. Redirects are not followed: a 3xx counts as a failed
 * attempt, so an endpoint cannot bounce our request to an internal address (SSRF).
 */
@Injectable()
export class FetchWebhookSender extends WebhookSender {
  async send(request: {
    url: string;
    body: string;
    headers: Record<string, string>;
  }): Promise<SendResult> {
    const started = Date.now();
    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await response.body?.cancel(); // the body is not needed; free the connection
      const ok = response.status >= 200 && response.status < 300;
      return {
        statusCode: response.status,
        error: ok ? null : `HTTP ${response.status}`,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      return {
        statusCode: null,
        error: timedOut ? `No response within ${TIMEOUT_MS / 1000} s` : describe(error),
        durationMs: Date.now() - started,
      };
    }
  }
}

/** "fetch failed" hides the useful part (ECONNREFUSED, ENOTFOUND) in `cause`. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return 'Request failed';
  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  return cause?.code ?? cause?.message ?? error.message;
}
