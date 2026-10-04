import type { AccessTokenResponse } from '@po/contracts';
import { useSession } from './session-store';

/** An RFC 9457 problem from the API, with its stable `code`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/**
 * Asks for a new access token using the httpOnly refresh cookie (the browser sends it; JavaScript
 * never sees it). Concurrent 401s share one refresh: the server rotates the token on every use,
 * and two parallel refreshes with the same token would look like token theft.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await fetch('/v1/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!response.ok) {
        useSession.getState().clear();
        return false;
      }
      const body = (await response.json()) as AccessTokenResponse;
      useSession.getState().setSession(body.accessToken, body.user);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function toApiError(response: Response): Promise<ApiError> {
  const problem = (await response.json().catch(() => ({}))) as {
    code?: string;
    detail?: string;
    title?: string;
  };
  return new ApiError(
    response.status,
    problem.code ?? `http.${response.status}`,
    problem.detail ?? problem.title ?? 'Request failed',
  );
}

/** Calls the API with the access token; on 401 refreshes once and retries. */
export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = useSession.getState().accessToken;
  const response = await fetch(`/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  // Auth endpoints answer 401 for bad credentials: refreshing there would be pointless.
  if (
    response.status === 401 &&
    !retried &&
    !path.startsWith('/auth/') &&
    (await refreshSession())
  ) {
    return api<T>(path, init, true);
  }
  if (!response.ok) throw await toApiError(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
