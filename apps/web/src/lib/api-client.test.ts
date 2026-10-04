import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api-client';
import { useSession } from './session-store';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const user = { id: 'u1', email: 'o@acme.test', role: 'owner', organizationId: 'org-1' } as const;

describe('api client', () => {
  beforeEach(() => useSession.getState().setSession('expired-token', user));
  afterEach(() => vi.unstubAllGlobals());

  it('sends the access token and returns the body', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(200, { data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/charges')).resolves.toEqual({ data: [] });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer expired-token',
    });
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(401, { code: 'auth.unauthenticated' }))
      .mockResolvedValueOnce(
        json(200, { accessToken: 'fresh-token', tokenType: 'Bearer', expiresIn: 900, user }),
      )
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/charges')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/v1/auth/refresh');
    expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer fresh-token',
    });
  });

  it('signs out and surfaces the problem when the session cannot be refreshed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          json(401, { code: 'auth.unauthenticated', detail: 'Missing or invalid credentials' }),
        )
        .mockResolvedValueOnce(json(401, { code: 'auth.invalid_session' })),
    );

    await expect(api('/charges')).rejects.toEqual(
      new ApiError(401, 'auth.unauthenticated', 'Missing or invalid credentials'),
    );
    expect(useSession.getState().accessToken).toBeNull();
  });
});
