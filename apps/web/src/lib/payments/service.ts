import { randomUUID } from 'node:crypto';

import type { PaymentCheckoutResponse, PaymentHistoryResponse, PaymentProvider } from '@study-assistant/shared-types';

import { normalizeAppUrl } from '@study-assistant/shared-utils';

import { applyPaymentCreditOnce } from '@/lib/billing/wallet';
import { env } from '@/lib/env/server';
import { RouteError } from '@/lib/http/route';
import { writeAuditLog } from '@/lib/observability/audit';
import { logEvent } from '@/lib/observability/logger';
import {
  attachCheckoutSession,
  createPaymentCustomerRecord,
  createPendingPayment,
  getActivePaymentPackage,
  getPaymentByCheckoutSessionId,
  getPaymentById,
  getPaymentCustomerForUser,
  getPaymentPackageById,
  listPaymentsForUser,
  markPaymentStatus,
} from '@/lib/supabase/payments';

import { PaymongoBillingProvider } from './paymongo';
import { StripeBillingProvider } from './stripe';

const stripeProvider = new StripeBillingProvider();
const paymongoProvider = new PaymongoBillingProvider();

export function getBillingProviderAvailability() {
  return {
    stripe: env.STRIPE_ENABLED,
    paymongo: env.PAYMONGO_ENABLED,
  };
}

function assertAllowedReturnUrl(url: string) {
  const parsed = new URL(url);
  const allowedOrigin = normalizeAppUrl(env.NEXT_PUBLIC_APP_URL);

  if (normalizeAppUrl(parsed.toString()) !== allowedOrigin) {
    throw new RouteError(400, 'invalid_url', 'Checkout return URLs must stay on the configured app origin.');
  }
}

function assertProviderAvailable(provider: PaymentProvider) {
  const availability = getBillingProviderAvailability();

  if (availability[provider]) {
    return;
  }

  throw new RouteError(
    503,
    'payment_provider_unavailable',
    provider === 'paymongo'
      ? 'GCash, Maya, and bank checkout is not configured yet.'
      : 'Card checkout is not configured yet.',
  );
}

function assertPackageCurrencySupported(provider: PaymentProvider, currency: string) {
  if (provider !== 'paymongo') {
    return;
  }

  if (currency.toUpperCase() !== 'PHP') {
    throw new RouteError(
      400,
      'paymongo_currency_not_supported',
      'PayMongo checkout for GCash, Maya, and bank payments requires PHP-priced packages.',
    );
  }
}

async function resolveWebhookPayment(params: { paymentId?: string | null; checkoutSessionId?: string | null }) {
  if (params.paymentId) {
    return getPaymentById(params.paymentId);
  }

  if (params.checkoutSessionId) {
    return getPaymentByCheckoutSessionId(params.checkoutSessionId);
  }

  throw new RouteError(400, 'payment_lookup_failed', 'Webhook payload did not include a payment or checkout session id.');
}

async function finalizeSuccessfulPayment(params: {
  payment: Awaited<ReturnType<typeof getPaymentById>>;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  paidAt?: string | null;
  checkoutSessionId?: string | null;
  rawPayload: Record<string, unknown>;
  eventType?: string;
}) {
  if (params.payment.status === 'paid') {
    return { handled: true, ignored: false, duplicate: true };
  }

  if (!params.payment.package_id) {
    throw new RouteError(500, 'payment_package_missing', 'Paid payment record does not reference a package.');
  }

  const paymentPackage = await getPaymentPackageById(params.payment.package_id);
  const walletResult = await applyPaymentCreditOnce({
    paymentId: params.payment.id,
    providerPaymentId: params.providerPaymentId ?? params.payment.provider_payment_id,
    paidAt: params.paidAt ?? new Date().toISOString(),
    description: `${params.provider === 'paymongo' ? 'PayMongo' : 'Stripe'} top-up for ${paymentPackage.name}`,
    metadata: {
      checkoutSessionId: params.checkoutSessionId ?? params.payment.provider_checkout_session_id ?? '',
      packageCode: paymentPackage.code,
      provider: params.provider,
      ...(params.eventType ? { eventType: params.eventType } : {}),
    },
    rawPayload: params.rawPayload,
  });

  if (!walletResult.credited) {
    return { handled: true, ignored: false, duplicate: true };
  }

  await writeAuditLog({
    actorUserId: params.payment.user_id,
    actorRole: 'client',
    eventType: 'payment.credited',
    entityType: 'payments',
    entityId: params.payment.id,
    eventSummary: `Provisioned ${paymentPackage.seconds_to_credit} seconds from ${params.provider} payment ${params.payment.id}.`,
  });

  logEvent('info', 'payment.webhook.credited', {
    paymentId: params.payment.id,
    userId: params.payment.user_id,
    seconds: paymentPackage.seconds_to_credit,
    remainingSeconds: walletResult.remaining_seconds,
    provider: params.provider,
  });

  return { handled: true, ignored: false };
}

export async function createTopupCheckout(params: {
  userId: string;
  email: string;
  fullName: string;
  packageId: string;
  provider: PaymentProvider;
  successUrl: string;
  cancelUrl: string;
}): Promise<PaymentCheckoutResponse> {
  assertProviderAvailable(params.provider);
  assertAllowedReturnUrl(params.successUrl);
  assertAllowedReturnUrl(params.cancelUrl);

  const paymentPackage = await getActivePaymentPackage(params.packageId);
  assertPackageCurrencySupported(params.provider, paymentPackage.currency);
  let customerId: string | null = null;

  if (params.provider === 'stripe') {
    const existingCustomer = await getPaymentCustomerForUser({
      userId: params.userId,
      provider: 'stripe',
    });

    customerId = await stripeProvider.ensureCustomer({
      email: params.email,
      fullName: params.fullName,
      userId: params.userId,
      existingCustomerId: existingCustomer?.provider_customer_id ?? null,
    });

    if (!existingCustomer) {
      await createPaymentCustomerRecord({
        userId: params.userId,
        provider: 'stripe',
        providerCustomerId: customerId,
      });
    }
  }

  const pendingPayment = await createPendingPayment({
    userId: params.userId,
    packageId: paymentPackage.id,
    provider: params.provider,
    providerPaymentId: `${params.provider}_pending_${randomUUID()}`,
    amountMinor: paymentPackage.amount_minor,
    currency: paymentPackage.currency,
    rawPayload: {
      phase: 'pending_checkout',
      provider: params.provider,
    },
  });

  if (!pendingPayment) {
    throw new RouteError(500, 'payment_creation_failed', 'Failed to create pending payment record.');
  }

  const provider = params.provider === 'paymongo' ? paymongoProvider : stripeProvider;
  const checkout = await provider.createTopupCheckout({
    customerId,
    customerEmail: params.email,
    customerName: params.fullName,
    packageName: paymentPackage.name,
    packageDescription: paymentPackage.description,
    amountMinor: paymentPackage.amount_minor,
    currency: paymentPackage.currency,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    providerPriceReference: paymentPackage.provider_price_reference,
    metadata: {
      paymentId: pendingPayment.id,
      packageId: paymentPackage.id,
      userId: params.userId,
      provider: params.provider,
    },
    paymentMethodTypes: params.provider === 'paymongo' ? ['gcash', 'paymaya', 'dob', 'dob_ubp', 'card'] : undefined,
  });

  await attachCheckoutSession({
    paymentId: pendingPayment.id,
    checkoutSessionId: checkout.checkoutSessionId,
    providerPaymentId: checkout.providerPaymentId,
    rawPayload: checkout.rawPayload,
  });

  logEvent('info', 'payment.checkout.created', {
    paymentId: pendingPayment.id,
    userId: params.userId,
    packageId: paymentPackage.id,
    checkoutSessionId: checkout.checkoutSessionId,
    provider: params.provider,
  });

  return {
    checkoutUrl: checkout.checkoutUrl,
    checkoutSessionId: checkout.checkoutSessionId,
    paymentId: pendingPayment.id,
    provider: params.provider,
  };
}

export async function getPaymentHistory(userId: string): Promise<PaymentHistoryResponse> {
  const payments = await listPaymentsForUser(userId);

  return {
    payments: payments.map((payment: any) => ({
      id: payment.id,
      provider: payment.provider,
      providerPaymentId: payment.provider_payment_id,
      amountMinor: payment.amount_minor,
      currency: payment.currency,
      status: payment.status,
      paymentType: payment.payment_type,
      createdAt: payment.created_at,
      paidAt: payment.paid_at,
      packageCode: payment.payment_packages?.code ?? null,
      packageName: payment.payment_packages?.name ?? null,
    })),
  };
}

export async function handleStripeWebhook(rawBody: string, signature: string) {
  const event = stripeProvider.verifyWebhook(rawBody, signature);

  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded' &&
    event.type !== 'checkout.session.expired'
  ) {
    return { handled: true, ignored: true };
  }

  if (!event.checkoutSessionId) {
    throw new RouteError(400, 'invalid_stripe_event', 'Stripe event payload did not contain a checkout session id.');
  }

  const payment = await getPaymentByCheckoutSessionId(event.checkoutSessionId);

  if (event.type === 'checkout.session.expired') {
    if (payment.status === 'pending') {
      await markPaymentStatus({
        paymentId: payment.id,
        status: 'canceled',
        providerPaymentId: event.providerPaymentId ?? payment.provider_payment_id,
        rawPayload: event.rawPayload,
      });
    }

    return { handled: true, ignored: false };
  }

  return finalizeSuccessfulPayment({
    payment,
    provider: 'stripe',
    providerPaymentId: event.providerPaymentId ?? payment.provider_payment_id,
    paidAt: event.paidAt,
    checkoutSessionId: event.checkoutSessionId,
    rawPayload: event.rawPayload,
    eventType: event.type,
  });
}

export async function handlePaymongoWebhook(rawBody: string, signature: string) {
  const event = paymongoProvider.verifyWebhook(rawBody, signature);

  if (/(failed)$/i.test(event.type)) {
    const payment = await resolveWebhookPayment({
      paymentId: event.metadata.paymentId ?? null,
      checkoutSessionId: event.checkoutSessionId,
    });

    if (payment.status === 'pending') {
      await markPaymentStatus({
        paymentId: payment.id,
        status: 'failed',
        providerPaymentId: event.providerPaymentId ?? payment.provider_payment_id,
        rawPayload: event.rawPayload,
      });
    }

    return { handled: true, ignored: false };
  }

  if (/(expired|cancelled|canceled)$/i.test(event.type)) {
    const payment = await resolveWebhookPayment({
      paymentId: event.metadata.paymentId ?? null,
      checkoutSessionId: event.checkoutSessionId,
    });

    if (payment.status === 'pending') {
      await markPaymentStatus({
        paymentId: payment.id,
        status: 'canceled',
        providerPaymentId: event.providerPaymentId ?? payment.provider_payment_id,
        rawPayload: event.rawPayload,
      });
    }

    return { handled: true, ignored: false };
  }

  if (!/(paid)$/i.test(event.type)) {
    return { handled: true, ignored: true };
  }

  const payment = await resolveWebhookPayment({
    paymentId: event.metadata.paymentId ?? null,
    checkoutSessionId: event.checkoutSessionId,
  });

  return finalizeSuccessfulPayment({
    payment,
    provider: 'paymongo',
    providerPaymentId: event.providerPaymentId ?? payment.provider_payment_id,
    paidAt: event.paidAt,
    checkoutSessionId: event.checkoutSessionId,
    rawPayload: event.rawPayload,
    eventType: event.type,
  });
}
