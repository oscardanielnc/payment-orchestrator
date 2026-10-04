import type { CurrentUser } from '@po/contracts';
import { create } from 'zustand';

interface SessionState {
  /** In memory only: never localStorage (an XSS could read it there). */
  accessToken: string | null;
  user: CurrentUser | null;
  /** True once the startup refresh attempt finished, signed in or not. */
  ready: boolean;
  setSession: (accessToken: string, user: CurrentUser) => void;
  clear: () => void;
  markReady: () => void;
}

export const useSession = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  ready: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
  markReady: () => set({ ready: true }),
}));
