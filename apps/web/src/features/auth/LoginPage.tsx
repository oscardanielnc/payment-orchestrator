import type { AccessTokenResponse } from '@po/contracts';
import { TestModeBanner } from '@po/ui/feedback/States/States';
import { TextField } from '@po/ui/forms/TextField/TextField';
import { Button } from '@po/ui/primitives/Button/Button';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { api, ApiError } from '../../lib/api-client';
import { useSession } from '../../lib/session-store';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, setSession } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () =>
      api<AccessTokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: (session) => {
      setSession(session.accessToken, session.user);
      const from = (location.state as { from?: string } | null)?.from ?? '/charges';
      void navigate(from, { replace: true });
    },
  });

  if (accessToken) return <Navigate to="/charges" replace />;

  const error =
    login.error instanceof ApiError
      ? login.error.status === 429
        ? 'Too many attempts. Wait a minute and try again.'
        : 'Invalid email or password'
      : login.error
        ? 'Could not reach the server'
        : undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate();
  };

  return (
    <div className="min-h-dvh bg-bg">
      <TestModeBanner
        networks={['Stripe test', 'Mercado Pago test', 'TRON Nile', 'Base Sepolia']}
      />
      <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
        <div>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-muted">Payment Orchestrator merchant dashboard</p>
        </div>
        <form
          onSubmit={submit}
          className="flex flex-col gap-4 rounded-md border border-line bg-surface p-5"
          noValidate
        >
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
          />
          <Button type="submit" loading={login.isPending}>
            Sign in
          </Button>
        </form>
      </main>
    </div>
  );
}
