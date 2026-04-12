import { RouteError } from '@/lib/http/route';

import { paymentPackageSchema, paymentRecordSchema, type PaymentPackageRecord, type PaymentRecord } from './schemas';
import { getSupabaseAdmin } from './server';
import { assertSupabaseResult, parseSingle } from './utils';

export async function getActivePaymentPackage(packageId: string): Promise<PaymentPackageRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payment_packages')
    .select('id, code, name, description, seconds_to_credit, amount_minor, currency, provider_price_reference, is_active, credit_expires_after_days')
    .eq('id', packageId)
    .eq('is_active', true)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load payment package.');

  if (!data) {
    throw new RouteError(404, 'payment_package_not_found', 'Payment package not found.');
  }

  return parseSingle(data, paymentPackageSchema, 'Payment package is invalid.');
}

export async function listActivePaymentPackages(): Promise<PaymentPackageRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payment_packages')
    .select('id, code, name, description, seconds_to_credit, amount_minor, currency, provider_price_reference, is_active, credit_expires_after_days')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  assertSupabaseResult(error, 'Failed to load payment packages.');
  return (data ?? []).map((row) => parseSingle(row, paymentPackageSchema, 'Payment package is invalid.'));
}

export async function getPaymentPackageById(packageId: string): Promise<PaymentPackageRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payment_packages')
    .select('id, code, name, description, seconds_to_credit, amount_minor, currency, provider_price_reference, is_active, credit_expires_after_days')
    .eq('id', packageId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load payment package.');

  if (!data) {
    throw new RouteError(404, 'payment_package_not_found', 'Payment package not found.');
  }

  return parseSingle(data, paymentPackageSchema, 'Payment package is invalid.');
}

export async function getPaymentCustomerForUser(params: { userId: string; provider: 'stripe' | 'paymongo' }) {
  const supabase = getSupabaseAdmin();

  const existing = await supabase
    .from('payment_customers')
    .select('id, provider_customer_id')
    .eq('user_id', params.userId)
    .eq('provider', params.provider)
    .maybeSingle();

  assertSupabaseResult(existing.error, 'Failed to load payment customer.');

  return existing.data;
}

export async function createPaymentCustomerRecord(params: {
  userId: string;
  provider: 'stripe' | 'paymongo';
  providerCustomerId: string;
}) {
  const supabase = getSupabaseAdmin();

  const inserted = await supabase
    .from('payment_customers')
    .insert({
      user_id: params.userId,
      provider: params.provider,
      provider_customer_id: params.providerCustomerId,
    })
    .select('id, provider_customer_id')
    .single();

  assertSupabaseResult(inserted.error, 'Failed to create payment customer.');
  return inserted.data;
}

export async function createPendingPayment(params: {
  userId: string;
  packageId: string;
  provider: 'stripe' | 'paymongo';
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  rawPayload: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payments')
    .insert({
      user_id: params.userId,
      package_id: params.packageId,
      provider: params.provider,
      provider_payment_id: params.providerPaymentId,
      amount_minor: params.amountMinor,
      currency: params.currency,
      status: 'pending',
      payment_type: 'topup',
      raw_payload: params.rawPayload,
    })
    .select('id')
    .single();

  assertSupabaseResult(error, 'Failed to create pending payment.');
  return data;
}

export async function attachCheckoutSession(params: {
  paymentId: string;
  checkoutSessionId: string;
  providerPaymentId: string;
  rawPayload: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('payments')
    .update({
      provider_checkout_session_id: params.checkoutSessionId,
      provider_payment_id: params.providerPaymentId,
      raw_payload: params.rawPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.paymentId);

  assertSupabaseResult(error, 'Failed to attach checkout session.');
}

export async function getPaymentByCheckoutSessionId(checkoutSessionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payments')
    .select('id, user_id, package_id, provider, status, amount_minor, currency, provider_payment_id, provider_checkout_session_id')
    .eq('provider_checkout_session_id', checkoutSessionId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load payment by checkout session.');

  if (!data) {
    throw new RouteError(404, 'payment_not_found', 'Payment record not found.');
  }

  return data;
}

export async function getPaymentById(paymentId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payments')
    .select('id, user_id, package_id, provider, status, amount_minor, currency, provider_payment_id, provider_checkout_session_id')
    .eq('id', paymentId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load payment.');

  if (!data) {
    throw new RouteError(404, 'payment_not_found', 'Payment record not found.');
  }

  return data;
}

export async function markPaymentStatus(params: {
  paymentId: string;
  status: 'paid' | 'failed' | 'canceled' | 'refunded';
  paidAt?: string;
  providerPaymentId?: string;
  rawPayload: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('payments')
    .update({
      status: params.status,
      paid_at: params.paidAt ?? null,
      provider_payment_id: params.providerPaymentId,
      raw_payload: params.rawPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.paymentId);

  assertSupabaseResult(error, 'Failed to update payment status.');
}

export async function listPaymentsForUser(userId: string): Promise<PaymentRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id,
      provider,
      provider_payment_id,
      amount_minor,
      currency,
      status,
      payment_type,
      created_at,
      paid_at,
      package_id,
      payment_packages (
        code,
        name
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  assertSupabaseResult(error, 'Failed to load payment history.');
  return (data ?? []).map((row) => parseSingle(row, paymentRecordSchema, 'Payment history row is invalid.'));
}
