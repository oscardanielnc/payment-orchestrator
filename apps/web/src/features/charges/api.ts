import type {
  Charge,
  ChargeEventList,
  ChargeList,
  ChargeStatus,
  LedgerEntryList,
  PaymentAttemptList,
} from '@po/contracts';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';

export function useCharges(status: ChargeStatus | undefined) {
  return useInfiniteQuery({
    queryKey: ['charges', status ?? 'all'],
    // Keyset pagination: each page hands us the cursor for the next one.
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (status) params.set('status', status);
      if (pageParam) params.set('cursor', pageParam);
      return api<ChargeList>(`/charges?${params.toString()}`);
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Detail data refreshes every 5 s while the charge is still open, so payments appear live. */
const whileOpen = (status: string | undefined) =>
  status === 'pending' || status === 'processing' ? 5000 : false;

export function useCharge(id: string) {
  return useQuery({
    queryKey: ['charge', id],
    queryFn: () => api<Charge>(`/charges/${id}`),
    refetchInterval: (query) => whileOpen(query.state.data?.status),
  });
}

export function useChargeExtras(id: string, status: string | undefined) {
  const interval = whileOpen(status);
  const attempts = useQuery({
    queryKey: ['charge', id, 'attempts'],
    queryFn: () => api<PaymentAttemptList>(`/charges/${id}/attempts`),
    refetchInterval: interval,
  });
  const events = useQuery({
    queryKey: ['charge', id, 'events'],
    queryFn: () => api<ChargeEventList>(`/charges/${id}/events`),
    refetchInterval: interval,
  });
  const ledger = useQuery({
    queryKey: ['charge', id, 'ledger'],
    queryFn: () => api<LedgerEntryList>(`/charges/${id}/ledger-entries`),
    refetchInterval: interval,
  });
  return { attempts, events, ledger };
}
