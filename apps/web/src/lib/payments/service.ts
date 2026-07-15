import { randomUUID } from 'node:crypto';

import type { PaymentCheckoutResponse, PaymentHistoryResponse, PaymentProvider } from '@study-assistant/shared-types';

import { normalizeAppUrl } from '@study-assistant/shared-utils';

import { applyPaymentCreditOnce, reversePaymentCreditOnce } from '@/lib/billing/wallet';
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
  getPaymentByProviderPaymentId,
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
      ? 'QRPh, wallet, and bank checkout is not configured yet.'
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
      'PayMongo checkout for QRPh, wallets, and bank payments requires PHP-priced packages.',
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
  metadata?: Record<string, string>;
  paymentStatus?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
}) {
  if (params.payment.status === 'paid' || params.payment.status === 'refunded') {
    return { handled: true, ignored: false, duplicate: true };
  }

  if (!params.payment.package_id) {
    throw new RouteError(500, 'payment_package_missing', 'Paid payment record does not reference a package.');
  }

  if (params.payment.provider !== params.provider) {
    throw new RouteError(400, 'payment_provider_mismatch', 'Webhook provider does not match the payment record.');
  }

  if (params.metadata?.paymentId && params.metadata.paymentId !== params.payment.id) {
    throw new RouteError(400, 'payment_metadata_mismatch', 'Webhook payment metadata does not match the payment record.');
  }

  if (params.metadata?.userId && params.metadata.userId !== params.payment.user_id) {
    throw new RouteError(400, 'payment_metadata_mismatch', 'Webhook user metadata does not match the payment record.');
  }

  if (params.metadata?.packageId && params.metadata.packageId !== params.payment.package_id) {
    throw new RouteError(400, 'payment_metadata_mismatch', 'Webhook package metadata does not match the payment record.');
  }

  if (params.amountMinor !== null && params.amountMinor !== undefined && params.amountMinor !== params.payment.amount_minor) {
    throw new RouteError(400, 'payment_amount_mismatch', 'Webhook amount does not match the pending payment.');
  }

  if (params.currency && params.currency.toUpperCase() !== params.payment.currency.toUpperCase()) {
    throw new RouteError(400, 'payment_currency_mismatch', 'Webhook currency does not match the pending payment.');
  }

  if (params.provider === 'stripe' && params.paymentStatus !== 'paid') {
    throw new RouteError(400, 'payment_not_paid', 'Stripe checkout has not reached a paid state.');
  }

  if (!params.payment.entitlement_seconds || params.payment.entitlement_seconds <= 0) {
    throw new RouteError(500, 'payment_entitlement_missing', 'Payment does not contain a valid entitlement snapshot.');
  }

  const paymentPackage = await getPaymentPackageById(params.payment.package_id);
  const walletResult = await applyPaymentCreditOnce({
    paymentId: params.payment.id,
    providerPaymentId: params.providerPaymentId ?? params.payment.provider_payment_id,
    paidAt: params.paidAt ?? new Date().toISOString(),
    description: `${params.provider === 'paymongo' ? 'PayMongo' : 'Stripe'} top-up for ${paymentPackage.name}`,
    metadata: {
      checkoutSessionId: params.checkoutSessionId ?? params.payment.provider_checkout_session_id ?? '',
      packageCode: params.payment.entitlement_package_code ?? paymentPackage.code,
      entitlementSeconds: params.payment.entitlement_seconds,
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
    eventSummary: `Provisioned ${params.payment.entitlement_seconds} seconds from ${params.provider} payment ${params.payment.id}.`,
  });

  logEvent('info', 'payment.webhook.credited', {
    paymentId: params.payment.id,
    userId: params.payment.user_id,
    seconds: params.payment.entitlement_seconds,
    remainingSeconds: walletResult.remaining_seconds,
    provider: params.provider,
  });

  return { handled: true, ignored: false };
}

async function finalizePaymentReversal(params: {
  payment: Awaited<ReturnType<typeof getPaymentById>>;
  provider: PaymentProvider;
  refundedAmountMinor: number;
  eventType: string;
  rawPayload: Record<string, unknown>;
  currency?: string | null;
}) {
  if (params.payment.provider !== params.provider) {
    throw new RouteError(400, 'payment_provider_mismatch', 'Webhook provider does not match the payment record.');
  }

  if (params.currency && params.currency.toUpperCase() !== params.payment.currency.toUpperCase()) {
    throw new RouteError(400, 'payment_currency_mismatch', 'Reversal currency does not match the payment record.');
  }

  if (!Number.isInteger(params.refundedAmountMinor) || params.refundedAmountMinor <= 0) {
    throw new RouteError(400, 'payment_reversal_invalid', 'Webhook reversal amount is invalid.');
  }

  const result = await reversePaymentCreditOnce({
    paymentId: params.payment.id,
    refundedAmountMinor: params.refundedAmountMinor,
    reason: `${params.provider} ${params.eventType} entitlement reversal`,
    rawPayload: params.rawPayload,
  });

  await writeAuditLog({
    actorUserId: params.payment.user_id,
    actorRole: 'client',
    eventType: 'payment.entitlement_reversed',
    entityType: 'payments',
    entityId: params.payment.id,
    eventSummary: `Reversed ${result.reversedSeconds} seconds after ${params.provider} ${params.eventType}.`,
    newValues: {
      refundedAmountMinor: params.refundedAmountMinor,
      reversedSeconds: result.reversedSeconds,
      totalReversedSeconds: result.totalReversedSeconds,
      shortfallSeconds: result.shortfallSeconds,
      walletLocked: result.walletLocked,
    },
  });

  logEvent(result.walletLocked ? 'warn' : 'info', 'payment.webhook.reversed', {
    paymentId: params.payment.id,
    userId: params.payment.user_id,
    provider: params.provider,
    eventType: params.eventType,
    ...result,
  });

  return { handled: true, ignored: false, duplicate: result.reversedSeconds === 0 };
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
    entitlementSeconds: paymentPackage.seconds_to_credit,
    entitlementExpiresAfterDays: paymentPackage.credit_expires_after_days ?? null,
    entitlementPackageCode: paymentPackage.code,
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
    paymentMethodTypes: params.provider === 'paymongo' ? ['qrph', 'gcash', 'paymaya', 'dob', 'dob_ubp', 'card'] : undefined,
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
    event.type !== 'checkout.session.expired' &&
    event.type !== 'charge.refunded' &&
    event.type !== 'charge.dispute.created'
  ) {
    return { handled: true, ignored: true };
  }

  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    if (!event.providerPaymentId || !event.reversalAmountMinor) {
      throw new RouteError(400, 'invalid_stripe_event', 'Stripe reversal event did not contain a payment id and amount.');
    }

    const payment = await getPaymentByProviderPaymentId({
      provider: 'stripe',
      providerPaymentId: event.providerPaymentId,
    });
    return finalizePaymentReversal({
      payment,
      provider: 'stripe',
      refundedAmountMinor: event.reversalAmountMinor,
      eventType: event.type,
      rawPayload: event.rawPayload,
      currency: event.currency,
    });
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
    metadata: event.metadata,
    paymentStatus: event.paymentStatus,
    amountMinor: event.amountMinor,
    currency: event.currency,
  });
}

export async function handlePaymongoWebhook(rawBody: string, signature: string) {
  const event = paymongoProvider.verifyWebhook(rawBody, signature);

  if (/(refund|refunded|dispute)/i.test(event.type)) {
    const payment = await resolveWebhookPayment({
      paymentId: event.metadata.paymentId ?? null,
      checkoutSessionId: event.checkoutSessionId,
    });

    return finalizePaymentReversal({
      payment,
      provider: 'paymongo',
      refundedAmountMinor: event.reversalAmountMinor ?? payment.amount_minor,
      eventType: event.type,
      rawPayload: event.rawPayload,
      currency: event.currency,
    });
  }

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
    metadata: event.metadata,
    paymentStatus: event.paymentStatus,
    amountMinor: event.amountMinor,
    currency: event.currency,
  });
}
