import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const providerMocks = vi.hoisted(() => ({
  stripeVerifyWebhook: vi.fn(),
  paymongoVerifyWebhook: vi.fn(),
}));

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
      return providerMocks.stripeVerifyWebhook();
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
      return providerMocks.paymongoVerifyWebhook();
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
  getPaymentByProviderPaymentId: vi.fn(),
  listPaymentsForUser: vi.fn(),
  markPaymentStatus: vi.fn(),
}));

vi.mock('@/lib/supabase/payments', () => paymentMocks);

const walletMocks = vi.hoisted(() => ({
  applyPaymentCreditOnce: vi.fn(),
  reversePaymentCreditOnce: vi.fn(),
}));

vi.mock('@/lib/billing/wallet', () => walletMocks);
vi.mock('@/lib/observability/audit', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }));

describe('payment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerMocks.stripeVerifyWebhook.mockReturnValue({
      type: 'checkout.session.completed',
      checkoutSessionId: 'cs_test_123',
      providerPaymentId: 'pi_test_123',
      paidAt: '2026-03-14T00:00:00.000Z',
      paymentStatus: 'paid',
      amountMinor: 1000,
      currency: 'USD',
      reversalAmountMinor: null,
      metadata: { paymentId: 'pay_1' },
      rawPayload: { id: 'evt_stripe_1' },
    });
    providerMocks.paymongoVerifyWebhook.mockReturnValue({
      type: 'checkout_session.payment.paid',
      checkoutSessionId: 'paymongo_cs_test_123',
      providerPaymentId: 'paymongo_pi_test_123',
      paidAt: '2026-03-14T00:00:00.000Z',
      paymentStatus: 'paid',
      amountMinor: 1299,
      currency: 'PHP',
      reversalAmountMinor: null,
      metadata: { paymentId: 'pay_2' },
      rawPayload: { id: 'evt_paymongo_1' },
    });
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
      entitlement_seconds: 3600,
      entitlement_expires_after_days: null,
      entitlement_package_code: 'one-hour',
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
      entitlement_seconds: 10800,
      entitlement_expires_after_days: null,
      entitlement_package_code: 'three-hours',
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

  it('rejects a completed Stripe checkout that is not paid', async () => {
    providerMocks.stripeVerifyWebhook.mockReturnValue({
      ...providerMocks.stripeVerifyWebhook(),
      paymentStatus: 'unpaid',
    });
    paymentMocks.getPaymentByCheckoutSessionId.mockResolvedValue({
      id: 'pay_1',
      user_id: 'user-1',
      package_id: 'pkg-1',
      provider: 'stripe',
      status: 'pending',
      amount_minor: 1000,
      currency: 'USD',
      provider_payment_id: 'pi_test_123',
      provider_checkout_session_id: 'cs_test_123',
      entitlement_seconds: 3600,
      entitlement_expires_after_days: null,
      entitlement_package_code: 'one-hour',
    });

    const { handleStripeWebhook } = await import('@/lib/payments/service');
    await expect(handleStripeWebhook('payload', 'signature')).rejects.toMatchObject({ code: 'payment_not_paid' });
    expect(walletMocks.applyPaymentCreditOnce).not.toHaveBeenCalled();
  });

  it('does not restore a fully refunded payment when a success webhook is replayed', async () => {
    paymentMocks.getPaymentByCheckoutSessionId.mockResolvedValue({
      id: 'pay_1',
      user_id: 'user-1',
      package_id: 'pkg-1',
      provider: 'stripe',
      status: 'refunded',
      amount_minor: 1000,
      currency: 'USD',
      provider_payment_id: 'pi_test_123',
      provider_checkout_session_id: 'cs_test_123',
      entitlement_seconds: 3600,
      entitlement_expires_after_days: null,
      entitlement_package_code: 'one-hour',
    });

    const { handleStripeWebhook } = await import('@/lib/payments/service');
    const result = await handleStripeWebhook('payload', 'signature');

    expect(result).toMatchObject({ handled: true, duplicate: true });
    expect(walletMocks.applyPaymentCreditOnce).not.toHaveBeenCalled();
  });

  it('reverses credits idempotently when Stripe reports a refund', async () => {
    providerMocks.stripeVerifyWebhook.mockReturnValue({
      type: 'charge.refunded',
      checkoutSessionId: null,
      providerPaymentId: 'pi_test_123',
      paidAt: '2026-03-15T00:00:00.000Z',
      paymentStatus: 'paid',
      amountMinor: 1000,
      currency: 'USD',
      reversalAmountMinor: 1000,
      metadata: { paymentId: 'pay_1' },
      rawPayload: { id: 'evt_refund_1' },
    });
    paymentMocks.getPaymentByProviderPaymentId.mockResolvedValue({
      id: 'pay_1',
      user_id: 'user-1',
      package_id: 'pkg-1',
      provider: 'stripe',
      status: 'paid',
      amount_minor: 1000,
      currency: 'USD',
      provider_payment_id: 'pi_test_123',
      provider_checkout_session_id: 'cs_test_123',
      entitlement_seconds: 3600,
      entitlement_expires_after_days: null,
      entitlement_package_code: 'one-hour',
    });
    walletMocks.reversePaymentCreditOnce.mockResolvedValue({
      paymentStatus: 'refunded',
      reversedSeconds: 3600,
      totalReversedSeconds: 3600,
      shortfallSeconds: 0,
      remainingSeconds: 0,
      walletLocked: false,
    });

    const { handleStripeWebhook } = await import('@/lib/payments/service');
    const result = await handleStripeWebhook('payload', 'signature');

    expect(result.handled).toBe(true);
    expect(walletMocks.reversePaymentCreditOnce).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay_1', refundedAmountMinor: 1000 }),
    );
  });
});
