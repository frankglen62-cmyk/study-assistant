import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env/server';
import { RouteError } from '@/lib/http/route';

import type { BillingProvider, CheckoutSessionInput, CheckoutSessionResult, VerifiedWebhookEvent } from './provider';

function getPaymongoKey() {
  if (!env.PAYMONGO_SECRET_KEY) {
    throw new RouteError(503, 'paymongo_not_configured', 'GCash, Maya, and bank checkout is not configured yet.');
  }

  return env.PAYMONGO_SECRET_KEY;
}

function parseStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, typeof entry === 'string' ? entry : String(entry ?? '')]),
  );
}

function extractPaymongoErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return 'PayMongo checkout failed.';
  }

  if (Array.isArray((payload as { errors?: unknown[] }).errors)) {
    const first = (payload as { errors?: Array<{ detail?: string; code?: string }> }).errors?.[0];
    return first?.detail ?? first?.code ?? 'PayMongo checkout failed.';
  }

  return 'PayMongo checkout failed.';
}

function parseSignatureHeader(signature: string) {
  const parsed = signature
    .split(',')
    .map((entry) => entry.trim().split('='))
    .reduce<Record<string, string[]>>((accumulator, [key, value]) => {
      if (!key || !value) {
        return accumulator;
      }

      accumulator[key] = accumulator[key] ? [...accumulator[key], value] : [value];
      return accumulator;
    }, {});

  const timestamp = parsed.t?.[0] ?? null;
  const signatures = [...(parsed.te ?? []), ...(parsed.li ?? []), ...(parsed.v1 ?? [])];

  if (!timestamp || signatures.length === 0) {
    throw new RouteError(400, 'invalid_paymongo_signature', 'PayMongo signature header is invalid.');
  }

  return { timestamp, signatures };
}

export class PaymongoBillingProvider implements BillingProvider {
  readonly provider = 'paymongo' as const;

  async createTopupCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const encodedKey = Buffer.from(`${getPaymongoKey()}:`).toString('base64');

    const response = await fetch(`${env.PAYMONGO_API_BASE_URL}/checkout_sessions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${encodedKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              email: input.customerEmail,
              name: input.customerName,
            },
            cancel_url: input.cancelUrl,
            description: input.packageDescription,
            line_items: [
              {
                amount: input.amountMinor,
                currency: input.currency.toUpperCase(),
                description: input.packageDescription,
                name: input.packageName,
                quantity: 1,
              },
            ],
            metadata: input.metadata,
            payment_method_types: input.paymentMethodTypes ?? ['gcash', 'paymaya', 'dob', 'dob_ubp', 'card'],
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            success_url: input.successUrl,
          },
        },
      }),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => ({}))) as {
      data?: {
        id?: string;
        attributes?: {
          checkout_url?: string;
          payment_intent?: { id?: string } | null;
        };
      };
      errors?: Array<{ detail?: string; code?: string }>;
    };

    if (!response.ok) {
      throw new RouteError(502, 'paymongo_checkout_failed', extractPaymongoErrorMessage(payload), payload);
    }

    const checkoutSessionId = payload.data?.id;
    const checkoutUrl = payload.data?.attributes?.checkout_url;

    if (!checkoutSessionId || !checkoutUrl) {
      throw new RouteError(502, 'paymongo_checkout_failed', 'PayMongo did not return a checkout session URL.', payload);
    }

    return {
      checkoutUrl,
      checkoutSessionId,
      providerPaymentId: payload.data?.attributes?.payment_intent?.id ?? `paymongo_checkout_${checkoutSessionId}`,
      rawPayload: payload as unknown as Record<string, unknown>,
    };
  }

  verifyWebhook(rawBody: string, signature: string): VerifiedWebhookEvent {
    if (!env.PAYMONGO_WEBHOOK_SECRET) {
      throw new RouteError(503, 'paymongo_not_configured', 'PayMongo webhooks are not configured yet.');
    }

    const { timestamp, signatures } = parseSignatureHeader(signature);
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = createHmac('sha256', env.PAYMONGO_WEBHOOK_SECRET).update(signedPayload).digest('hex');

    const matched = signatures.some((entry) => {
      const normalizedEntry = entry.toLowerCase();

      if (normalizedEntry.length !== expectedSignature.length) {
        return false;
      }

      return timingSafeEqual(Buffer.from(normalizedEntry), Buffer.from(expectedSignature));
    });

    if (!matched) {
      throw new RouteError(400, 'invalid_paymongo_signature', 'PayMongo signature verification failed.');
    }

    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch (error) {
      throw new RouteError(400, 'invalid_paymongo_payload', 'PayMongo webhook payload must be valid JSON.', error);
    }

    const rootData = ((payload.data as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const rootAttributes = ((rootData.attributes as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const resource = ((rootAttributes.data as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const resourceAttributes = ((resource.attributes as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const payments = Array.isArray(resourceAttributes.payments) ? resourceAttributes.payments : [];
    const firstPayment = ((payments[0] as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const firstPaymentAttributes = ((firstPayment.attributes as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;

    const metadata = parseStringRecord(resourceAttributes.metadata ?? rootAttributes.metadata);
    const providerPaymentId =
      (typeof firstPayment.id === 'string' ? firstPayment.id : null) ??
      (typeof firstPaymentAttributes.id === 'string' ? firstPaymentAttributes.id : null) ??
      (typeof resourceAttributes.payment_intent_id === 'string' ? resourceAttributes.payment_intent_id : null);

    return {
      type:
        (typeof rootAttributes.type === 'string' ? rootAttributes.type : null) ??
        (typeof rootData.type === 'string' ? rootData.type : 'unknown'),
      checkoutSessionId: typeof resource.id === 'string' ? resource.id : null,
      providerPaymentId,
      paidAt:
        (typeof resourceAttributes.paid_at === 'string' ? resourceAttributes.paid_at : null) ??
        (typeof resourceAttributes.updated_at === 'string' ? resourceAttributes.updated_at : null) ??
        null,
      metadata,
      rawPayload: payload,
    };
  }
}
