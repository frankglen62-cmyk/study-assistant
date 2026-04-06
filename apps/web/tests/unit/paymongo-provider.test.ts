import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

function buildSignature(rawBody: string, timestamp: string, signatureKey: 'te' | 'li') {
  const digest = createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET ?? '')
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return `t=${timestamp},${signatureKey}=${digest}`;
}

function buildPaidPayload() {
  return JSON.stringify({
    data: {
      attributes: {
        type: 'checkout_session.payment.paid',
        data: {
          id: 'cs_test_checkout_123',
          attributes: {
            paid_at: '2026-04-06T12:00:00.000Z',
            metadata: {
              paymentId: 'pay_123',
              packageId: 'pkg_123',
            },
            payment_intent_id: 'pi_test_123',
            payments: [
              {
                id: 'paymongo_payment_123',
              },
            ],
          },
        },
      },
    },
  });
}

describe('PaymongoBillingProvider.verifyWebhook', () => {
  it.each(['te', 'li'] as const)('accepts the current %s signature format', async (signatureKey) => {
    const { PaymongoBillingProvider } = await import('@/lib/payments/paymongo');
    const provider = new PaymongoBillingProvider();
    const rawBody = buildPaidPayload();
    const signature = buildSignature(rawBody, '1712400000', signatureKey);

    const event = provider.verifyWebhook(rawBody, signature);

    expect(event.type).toBe('checkout_session.payment.paid');
    expect(event.checkoutSessionId).toBe('cs_test_checkout_123');
    expect(event.providerPaymentId).toBe('paymongo_payment_123');
    expect(event.paidAt).toBe('2026-04-06T12:00:00.000Z');
    expect(event.metadata.paymentId).toBe('pay_123');
  });

  it('rejects an invalid signature', async () => {
    const { RouteError } = await import('@/lib/http/route');
    const { PaymongoBillingProvider } = await import('@/lib/payments/paymongo');
    const provider = new PaymongoBillingProvider();
    const rawBody = buildPaidPayload();

    expect(() => provider.verifyWebhook(rawBody, 't=1712400000,te=invalid')).toThrow(RouteError);
  });
});
