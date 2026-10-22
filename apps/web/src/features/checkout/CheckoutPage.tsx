import type { CheckoutSession, PaymentMethod } from '@po/contracts';
import { Amount } from '@po/ui/data-display/Amount/Amount';
import { ErrorState, Skeleton, TestModeBanner } from '@po/ui/feedback/States/States';
import { Button } from '@po/ui/primitives/Button/Button';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '../../lib/api-client';
import { useCheckout, useChooseMethod } from './api';
import { CardPayment } from './CardPayment';
import { Countdown } from './Countdown';
import { CryptoInstructions } from './CryptoInstructions';
import { METHOD_LABEL } from './labels';

/** Public page behind a payment link: /pay/:token. No session, no dashboard code. */
export function CheckoutPage() {
  const { token = '' } = useParams();
  const checkout = useCheckout(token);

  return (
    <div className="min-h-dvh bg-bg">
      <TestModeBanner
        networks={['Stripe test', 'Mercado Pago test', 'TRON Nile', 'Base Sepolia']}
      />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
        {checkout.isPending ? (
          <Skeleton rows={4} label="Loading payment" />
        ) : checkout.isError ? (
          checkout.error instanceof ApiError && checkout.error.status === 404 ? (
            <Outcome title="This payment link does not exist">
              Check the link with whoever sent it to you.
            </Outcome>
          ) : (
            <ErrorState
              message="Could not load this payment."
              onRetry={() => void checkout.refetch()}
            />
          )
        ) : (
          <Session token={token} session={checkout.data} />
        )}
        <p className="text-center text-xs text-muted">
          Test environment: no real money moves. Cards use Stripe test mode, Mercado Pago uses test
          users, crypto uses testnets.
        </p>
      </main>
    </div>
  );
}

function Session({ token, session }: { token: string; session: CheckoutSession }) {
  return (
    <>
      <section
        aria-label="Payment summary"
        className="flex flex-col gap-1 rounded-md border border-line bg-surface p-5"
      >
        <p className="text-sm text-muted">{session.merchantName}</p>
        <Amount value={session.amount} currency={session.currency} size="hero" />
        {session.description && <p className="text-sm">{session.description}</p>}
        {(session.status === 'pending' || session.status === 'processing') && (
          <Countdown until={session.expiresAt} />
        )}
      </section>

      {session.status === 'succeeded' ? (
        <Outcome title="Payment received" tone="success">
          {session.merchantName} has been paid. You can close this page.
        </Outcome>
      ) : session.status === 'failed' ? (
        <Outcome title="This payment failed" tone="danger">
          Nothing was charged. Ask {session.merchantName} for a new link.
        </Outcome>
      ) : session.status === 'expired' ? (
        <Outcome title="This payment link has expired">
          Ask {session.merchantName} for a new link.
        </Outcome>
      ) : (
        <PayPanel token={token} session={session} />
      )}
    </>
  );
}

function PayPanel({ token, session }: { token: string; session: CheckoutSession }) {
  const choose = useChooseMethod(token);
  const queryClient = useQueryClient();
  const attempt = session.attempt;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['checkout', token] });

  if (session.methods.length === 0) {
    return (
      <Outcome title="No payment methods available">This currency cannot be paid here yet.</Outcome>
    );
  }

  return (
    <section
      aria-label="Pay"
      className="flex flex-col gap-4 rounded-md border border-line bg-surface p-5"
    >
      <div role="group" aria-label="Payment method" className="flex flex-wrap gap-2">
        {session.methods.map((method: PaymentMethod) => (
          <Button
            key={method}
            variant={attempt?.method === method ? 'primary' : 'secondary'}
            aria-pressed={attempt?.method === method}
            loading={choose.isPending && choose.variables === method}
            onClick={() => choose.mutate(method)}
          >
            {METHOD_LABEL[method]}
          </Button>
        ))}
      </div>

      {choose.isError && (
        <p role="alert" className="text-sm text-danger">
          This method could not be started. Try again or pick another one.
        </p>
      )}

      {attempt?.instructions.type === 'crypto_transfer' ? (
        <CryptoInstructions instructions={attempt.instructions} />
      ) : attempt?.instructions.type === 'card_client_secret' && session.stripePublishableKey ? (
        <CardPayment
          key={attempt.instructions.clientSecret}
          clientSecret={attempt.instructions.clientSecret}
          publishableKey={session.stripePublishableKey}
          onConfirmed={refresh}
        />
      ) : attempt?.instructions.type === 'redirect' ? (
        <RedirectInstructions url={attempt.instructions.url} />
      ) : (
        !attempt && <p className="text-sm text-muted">Choose how you want to pay.</p>
      )}
    </section>
  );
}

/**
 * Checkout Pro (ADR 0022): the customer pays on Mercado Pago's own page. A new tab keeps this
 * one open, polling, so it turns to "Payment received" by itself.
 */
function RedirectInstructions({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-max items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
      >
        Continue to Mercado Pago
      </a>
      <p className="text-sm text-muted">
        Opens Mercado Pago&apos;s test checkout in a new tab. Pay with a test account; this page
        updates by itself.
      </p>
    </div>
  );
}

const TONES = { success: 'text-success', danger: 'text-danger', neutral: 'text-ink' };

function Outcome({
  title,
  tone = 'neutral',
  children,
}: {
  title: string;
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <section
      role="status"
      className="flex flex-col gap-1 rounded-md border border-line bg-surface p-5"
    >
      <h1 className={`text-lg font-bold ${TONES[tone]}`}>{title}</h1>
      <p className="text-sm text-muted">{children}</p>
    </section>
  );
}
