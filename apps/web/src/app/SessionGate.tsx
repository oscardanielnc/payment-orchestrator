import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { refreshSession } from '../lib/api-client';
import { useSession } from '../lib/session-store';

/**
 * Wraps the merchant area only. The access token lives in memory, so a reload starts signed
 * out: the refresh cookie restores it here. The public checkout never runs this.
 */
export function SessionGate() {
  useEffect(() => {
    if (useSession.getState().ready) return;
    // StrictMode runs this twice; refreshSession shares one request in flight.
    void refreshSession().finally(() => useSession.getState().markReady());
  }, []);

  return <Outlet />;
}
