import type { CheckoutAttempt, CheckoutSession, PaymentMethod } from '@po/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api-client';

const FINAL = ['succeeded', 'failed', 'expired'];

/**
 * ADR 0012: poll every 3 s while the page is visible (TanStack Query pauses intervals in
 * background tabs) and stop for good on a final status.
 */
export function useCheckout(token: string) {
  return useQuery({
    queryKey: ['checkout', token],
    queryFn: () => api<CheckoutSession>(`/checkout/${token}`),
    refetchInterval: (query) =>
      FINAL.includes(query.state.data?.status ?? '') || query.state.error ? false : 3000,
    retry: (failures, error) =>
      !(error instanceof ApiError && error.status === 404) && failures < 2,
  });
}

export function useChooseMethod(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (method: PaymentMethod) =>
      api<CheckoutAttempt>(`/checkout/${token}/attempts`, {
        method: 'POST',
        body: JSON.stringify({ method }),
      }),
    // Show the instructions now instead of waiting for the next poll.
    onSuccess: (attempt) =>
      queryClient.setQueryData<CheckoutSession>(['checkout', token], (session) =>
        session ? { ...session, attempt, status: 'processing' } : session,
      ),
  });
}
