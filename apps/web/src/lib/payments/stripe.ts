import Stripe from 'stripe';

import { env } from '@/lib/env/server';
import { RouteError } from '@/lib/http/route';

import type { BillingProvider, CheckoutSessionInput, CheckoutSessionResult, VerifiedWebhookEvent } from './provider';

let stripeClient: Stripe | null = null;

function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new RouteError(503, 'stripe_not_configured', 'Card checkout is not configured yet.');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export class StripeBillingProvider implements BillingProvider {
  readonly provider = 'stripe' as const;

  async ensureCustomer(input: {
    email: string;
    fullName: string;
    existingCustomerId?: string | null;
    userId: string;
  }) {
    const stripe = getStripeClient();

    if (input.existingCustomerId) {
      return input.existingCustomerId;
    }

    const customer = await stripe.customers.create({
      email: input.email,
      name: input.fullName,
      metadata: {
        userId: input.userId,
      },
    });

    return customer.id;
  }

  async createTopupCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = getStripeClient();
    const customerId =
      input.customerId ??
      (await this.ensureCustomer({
        email: input.customerEmail,
        fullName: input.customerName,
        existingCustomerId: null,
        userId: input.metadata.userId ?? 'unknown',
      }));
    const lineItem =
      input.providerPriceReference
        ? {
            price: input.providerPriceReference,
            quantity: 1,
          }
        : {
            price_data: {
              currency: input.currency.toLowerCase(),
              product_data: {
                name: input.packageName,
                description: input.packageDescription,
              },
              unit_amount: input.amountMinor,
            },
            quantity: 1,
          };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [lineItem],
      allow_promotion_codes: false,
      payment_method_collection: 'always',
      metadata: input.metadata,
    });

    if (!session.url) {
      throw new RouteError(502, 'stripe_checkout_failed', 'Stripe did not return a checkout URL.');
    }

    return {
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
      providerPaymentId:
        typeof session.payment_intent === 'string' && session.payment_intent
          ? session.payment_intent
          : `stripe_checkout_${session.id}`,
      rawPayload: session as unknown as Record<string, unknown>,
    };
  }

  verifyWebhook(rawBody: string, signature: string): VerifiedWebhookEvent {
    const stripe = getStripeClient();
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new RouteError(503, 'stripe_not_configured', 'Stripe webhooks are not configured yet.');
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    const session = event.data.object as Stripe.Checkout.Session;

    return {
      type: event.type,
      checkoutSessionId: session.id ?? null,
      providerPaymentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      paidAt: new Date().toISOString(),
      metadata: Object.fromEntries(Object.entries(session.metadata ?? {}).map(([key, value]) => [key, value ?? ''])),
      rawPayload: event as unknown as Record<string, unknown>,
    };
  }
}
