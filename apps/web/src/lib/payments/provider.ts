import type { PaymentProvider } from '@study-assistant/shared-types';

export interface CheckoutSessionResult {
  checkoutUrl: string;
  checkoutSessionId: string;
  providerPaymentId: string;
  rawPayload: Record<string, unknown>;
}

export interface CheckoutSessionInput {
  customerId?: string | null;
  customerEmail: string;
  customerName: string;
  packageName: string;
  packageDescription: string;
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  providerPriceReference?: string | null;
  paymentMethodTypes?: string[];
}

export interface VerifiedWebhookEvent {
  type: string;
  checkoutSessionId: string | null;
  providerPaymentId: string | null;
  paidAt: string | null;
  metadata: Record<string, string>;
  rawPayload: Record<string, unknown>;
}

export interface BillingProvider {
  readonly provider: PaymentProvider;
  createTopupCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  verifyWebhook(rawBody: string, signature: string): VerifiedWebhookEvent;
}
