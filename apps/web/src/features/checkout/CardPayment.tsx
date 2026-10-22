import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Button } from '@po/ui/primitives/Button/Button';
import { type FormEvent, useState } from 'react';

// One Stripe.js instance per key for the whole page life.
const instances = new Map<string, Promise<Stripe | null>>();
const stripeFor = (publishableKey: string) => {
  if (!instances.has(publishableKey)) instances.set(publishableKey, loadStripe(publishableKey));
  return instances.get(publishableKey) ?? null;
};

interface CardPaymentProps {
  clientSecret: string;
  publishableKey: string;
  /** Stripe accepted the card; the webhook settles the charge and the poll shows it. */
  onConfirmed: () => void;
}

/**
 * The card is typed into Stripe's iframe: card data goes from the browser to Stripe and never
 * touches our servers (PCI SAQ A). We only hold the PaymentIntent's client secret.
 */
export function CardPayment({ clientSecret, publishableKey, onConfirmed }: CardPaymentProps) {
  return (
    <Elements
      stripe={stripeFor(publishableKey)}
      options={{ clientSecret, appearance: { theme: 'stripe' } }}
    >
      <CardForm onConfirmed={onConfirmed} />
    </Elements>
  );
}

function CardForm({ onConfirmed }: { onConfirmed: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    // Card-only intent without redirects (ADR 0016): no return URL needed.
    const result = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    setSubmitting(false);
    if (result.error) {
      // A decline keeps the charge open: the customer can fix the card and try again.
      setError(result.error.message ?? 'The card was not accepted');
      return;
    }
    setConfirmed(true);
    onConfirmed();
  };

  if (confirmed) {
    return (
      <p role="status" className="text-sm text-muted">
        Card accepted. Confirming the payment…
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      {/* Link would also offer bank debits and Klarna, which the "Card" button never promised */}
      <PaymentElement options={{ layout: 'tabs', wallets: { link: 'never' } }} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" loading={submitting} disabled={!stripe || submitting}>
        Pay
      </Button>
    </form>
  );
}
