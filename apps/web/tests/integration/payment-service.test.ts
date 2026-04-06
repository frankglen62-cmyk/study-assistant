import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

vi.mock('@/lib/payments/stripe', () => ({
  StripeBillingProvider: class {
    provider = 'stripe' as const;

    async ensureCustomer() {
      return 'cus_test_123';
    }

    async createTopupCheckout() {
      return {
        checkoutUrl: 'https://checkout.stripe.test/session',
        checkoutSessionId: 'cs_test_123',
        providerPaymentId: 'pi_test_123',
        rawPayload: { id: 'cs_test_123' },
      };
    }

    verifyWebhook() {
      return {
        type: 'checkout.session.completed',
        checkoutSessionId: 'cs_test_123',
        providerPaymentId: 'pi_test_123',
        paidAt: '2026-03-14T00:00:00.000Z',
        metadata: {
          paymentId: 'pay_1',
        },
        rawPayload: { id: 'evt_stripe_1' },
      };
    }
  },
}));

vi.mock('@/lib/payments/paymongo', () => ({
  PaymongoBillingProvider: class {
    provider = 'paymongo' as const;

    async createTopupCheckout(input: { paymentMethodTypes?: string[] }) {
      return {
        checkoutUrl: 'https://checkout.paymongo.test/session',
        checkoutSessionId: 'paymongo_cs_test_123',
        providerPaymentId: 'paymongo_pi_test_123',
        rawPayload: { data: { id: 'paymongo_cs_test_123' }, paymentMethodTypes: input.paymentMethodTypes ?? [] },
      };
    }

    verifyWebhook() {
      return {
        type: 'checkout_session.payment.paid',
        checkoutSessionId: 'paymongo_cs_test_123',
        providerPaymentId: 'paymongo_pi_test_123',
        paidAt: '2026-03-14T00:00:00.000Z',
        metadata: {
          paymentId: 'pay_2',
        },
        rawPayload: { id: 'evt_paymongo_1' },
      };
    }
  },
}));

const paymentMocks = vi.hoisted(() => ({
  getActivePaymentPackage: vi.fn(),
  getPaymentPackageById: vi.fn(),
  getPaymentCustomerForUser: vi.fn(),
  createPaymentCustomerRecord: vi.fn(),
  createPendingPayment: vi.fn(),
  attachCheckoutSession: vi.fn(),
  getPaymentById: vi.fn(),
  getPaymentByCheckoutSessionId: vi.fn(),
  listPaymentsForUser: vi.fn(),
  markPaymentStatus: vi.fn(),
}));

vi.mock('@/lib/supabase/payments', () => paymentMocks);

const walletMocks = vi.hoisted(() => ({
  applyPaymentCreditOnce: vi.fn(),
}));

vi.mock('@/lib/billing/wallet', () => walletMocks);
vi.mock('@/lib/observability/audit', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }));

describe('payment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a checkout session and persists the Stripe checkout linkage', async () => {
    paymentMocks.getActivePaymentPackage.mockResolvedValue({
      id: 'pkg-1',
      code: 'one-hour',
      name: '1 Hour',
      description: 'Starter package',
      seconds_to_credit: 3600,
      amount_minor: 1000,
      currency: 'usd',
      provider_price_reference: null,
      is_active: true,
    });
    paymentMocks.getPaymentCustomerForUser.mockResolvedValue(null);
    paymentMocks.createPendingPayment.mockResolvedValue({ id: 'pay_1' });

    const { createTopupCheckout } = await import('@/lib/payments/service');
    const result = await createTopupCheckout({
      userId: 'user-1',
      email: 'client@example.com',
      fullName: 'Client User',
      packageId: 'pkg-1',
      provider: 'stripe',
      successUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel',
    });

    expect(result.checkoutSessionId).toBe('cs_test_123');
    expect(result.provider).toBe('stripe');
    expect(paymentMocks.attachCheckoutSession).toHaveBeenCalledOnce();
    expect(paymentMocks.createPaymentCustomerRecord).toHaveBeenCalledOnce();
  });

  it('creates a PayMongo checkout session for QRPh, GCash, Maya, and bank methods', async () => {
    paymentMocks.getActivePaymentPackage.mockResolvedValue({
      id: 'pkg-2',
      code: 'three-hours',
      name: '3 Hours',
      description: 'Student package',
      seconds_to_credit: 10800,
      amount_minor: 1299,
      currency: 'PHP',
      provider_price_reference: null,
      is_active: true,
    });
    paymentMocks.createPendingPayment.mockResolvedValue({ id: 'pay_2' });

    const { createTopupCheckout } = await import('@/lib/payments/service');
    const result = await createTopupCheckout({
      userId: 'user-2',
      email: 'student@example.com',
      fullName: 'Student User',
      packageId: 'pkg-2',
      provider: 'paymongo',
      successUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel',
    });

    expect(result.checkoutSessionId).toBe('paymongo_cs_test_123');
    expect(result.provider).toBe('paymongo');
    expect(paymentMocks.createPaymentCustomerRecord).not.toHaveBeenCalled();
    expect(paymentMocks.attachCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        rawPayload: expect.objectContaining({
          paymentMethodTypes: expect.arrayContaining(['qrph', 'gcash', 'paymaya', 'dob', 'dob_ubp', 'card']),
        }),
      }),
    );
  });

  it('rejects PayMongo checkout when the package is not priced in PHP', async () => {
    paymentMocks.getActivePaymentPackage.mockResolvedValue({
      id: 'pkg-3',
      code: 'five-hours',
      name: '5 Hours',
      description: 'Popular package',
      seconds_to_credit: 18000,
      amount_minor: 1999,
      currency: 'USD',
      provider_price_reference: null,
      is_active: true,
    });

    const { createTopupCheckout } = await import('@/lib/payments/service');

    await expect(
      createTopupCheckout({
        userId: 'user-3',
        email: 'wallet@example.com',
        fullName: 'Wallet User',
        packageId: 'pkg-3',
        provider: 'paymongo',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      }),
    ).rejects.toMatchObject({
      code: 'paymongo_currency_not_supported',
    });

    expect(paymentMocks.createPendingPayment).not.toHaveBeenCalled();
  });

  it('credits the wallet once when a Stripe checkout completes', async () => {
    paymentMocks.getPaymentByCheckoutSessionId.mockResolvedValue({
      id: 'pay_1',
      user_id: 'user-1',
      package_id: 'pkg-1',
      provider: 'stripe',
      status: 'pending',
      amount_minor: 1000,
      currency: 'usd',
      provider_payment_id: 'pi_test_123',
      provider_checkout_session_id: 'cs_test_123',
    });
    paymentMocks.getPaymentPackageById.mockResolvedValue({
      id: 'pkg-1',
      code: 'one-hour',
      name: '1 Hour',
      description: 'Starter package',
      seconds_to_credit: 3600,
      amount_minor: 1000,
      currency: 'usd',
      provider_price_reference: null,
      is_active: true,
    });
    walletMocks.applyPaymentCreditOnce.mockResolvedValue({ remaining_seconds: 3600, credited: true, payment_status: 'paid' });

    const { handleStripeWebhook } = await import('@/lib/payments/service');
    const result = await handleStripeWebhook('payload', 'signature');

    expect(result.handled).toBe(true);
    expect(walletMocks.applyPaymentCreditOnce).toHaveBeenCalledOnce();
  });

  it('credits the wallet once when a PayMongo checkout is paid', async () => {
    paymentMocks.getPaymentById.mockResolvedValue({
      id: 'pay_2',
      user_id: 'user-2',
      package_id: 'pkg-2',
      provider: 'paymongo',
      status: 'pending',
      amount_minor: 1299,
      currency: 'PHP',
      provider_payment_id: 'paymongo_pi_test_123',
      provider_checkout_session_id: 'paymongo_cs_test_123',
    });
    paymentMocks.getPaymentPackageById.mockResolvedValue({
      id: 'pkg-2',
      code: 'three-hours',
      name: '3 Hours',
      description: 'Student package',
      seconds_to_credit: 10800,
      amount_minor: 1299,
      currency: 'PHP',
      provider_price_reference: null,
      is_active: true,
    });
    walletMocks.applyPaymentCreditOnce.mockResolvedValue({ remaining_seconds: 10800, credited: true, payment_status: 'paid' });

    const { handlePaymongoWebhook } = await import('@/lib/payments/service');
    const result = await handlePaymongoWebhook('payload', 'signature');

    expect(result.handled).toBe(true);
    expect(walletMocks.applyPaymentCreditOnce).toHaveBeenCalledOnce();
  });
});
