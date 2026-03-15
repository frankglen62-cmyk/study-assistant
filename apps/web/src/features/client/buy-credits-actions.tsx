'use client';

import { startTransition, useState } from 'react';

import type { PaymentCheckoutRequest, PaymentProvider } from '@study-assistant/shared-types';

import { Button } from '@study-assistant/ui';

interface PackageCardActionProps {
  packageId: string;
  supportsStripe: boolean;
  supportsPaymongo: boolean;
}

export function PackageCardAction({ packageId, supportsStripe, supportsPaymongo }: PackageCardActionProps) {
  const [pendingProvider, setPendingProvider] = useState<PaymentProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleBuyNow(provider: PaymentProvider) {
    startTransition(() => {
      void (async () => {
        setPendingProvider(provider);
        setErrorMessage(null);

        try {
          const response = await fetch('/api/client/payments/create-checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              packageId,
              provider,
              successUrl: `${window.location.origin}/buy-credits?status=success`,
              cancelUrl: `${window.location.origin}/buy-credits?status=cancelled`,
            } satisfies PaymentCheckoutRequest),
          });

          const payload = (await response.json()) as { checkoutUrl?: string; error?: string };
          if (!response.ok || !payload.checkoutUrl) {
            throw new Error(payload.error ?? 'Checkout creation failed.');
          }

          window.location.assign(payload.checkoutUrl);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Checkout creation failed.');
        } finally {
          setPendingProvider(null);
        }
      })();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={() => handleBuyNow('paymongo')}
        disabled={pendingProvider !== null || !supportsPaymongo}
        className="w-full"
      >
        {pendingProvider === 'paymongo' ? 'Preparing GCash / Maya Checkout...' : 'GCash / Maya / Bank'}
      </Button>
      <Button
        onClick={() => handleBuyNow('stripe')}
        disabled={pendingProvider !== null || !supportsStripe}
        variant={supportsPaymongo ? 'secondary' : 'primary'}
        className="w-full"
      >
        {pendingProvider === 'stripe' ? 'Preparing Card Checkout...' : 'Pay with Card'}
      </Button>
      {!supportsPaymongo ? (
        <p className="text-xs text-muted-foreground">GCash, Maya, and bank checkout will appear here once PayMongo is configured.</p>
      ) : null}
      {!supportsStripe ? (
        <p className="text-xs text-muted-foreground">Card checkout will appear here once Stripe is configured.</p>
      ) : null}
      {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
