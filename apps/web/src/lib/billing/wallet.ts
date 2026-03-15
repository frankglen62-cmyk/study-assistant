import { z } from 'zod';

import type { CreditTransactionType, PaymentStatus, WalletStatus } from '@study-assistant/shared-types';

import { RouteError } from '@/lib/http/route';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertSupabaseResult } from '@/lib/supabase/utils';

const walletMutationSchema = z.object({
  wallet_id: z.string().uuid(),
  remaining_seconds: z.number().int().nonnegative(),
  lifetime_seconds_purchased: z.number().int().nonnegative(),
  lifetime_seconds_used: z.number().int().nonnegative(),
});

const paymentWalletMutationSchema = walletMutationSchema.extend({
  payment_status: z.enum(['pending', 'paid', 'failed', 'canceled', 'refunded']),
  credited: z.boolean(),
});

export async function applyWalletSeconds(params: {
  userId: string;
  deltaSeconds: number;
  transactionType: CreditTransactionType;
  description: string;
  relatedPaymentId?: string | null;
  relatedSessionId?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc('apply_wallet_seconds', {
      p_user_id: params.userId,
      p_delta_seconds: params.deltaSeconds,
      p_transaction_type: params.transactionType,
      p_description: params.description,
      p_related_payment_id: params.relatedPaymentId ?? null,
      p_related_session_id: params.relatedSessionId ?? null,
      p_metadata: params.metadata ?? {},
      p_created_by: params.createdBy ?? null,
    })
    .single();

  if (error) {
    if (error.message.toLowerCase().includes('insufficient credits')) {
      throw new RouteError(402, 'insufficient_credits', 'Not enough credits remain for this action.');
    }

    assertSupabaseResult(error, 'Failed to apply wallet transaction.');
  }

  return walletMutationSchema.parse(data);
}

export async function applyPaymentCreditOnce(params: {
  paymentId: string;
  providerPaymentId?: string | null;
  paidAt?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
  rawPayload?: Record<string, unknown>;
}): Promise<PaymentWalletMutationResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc('apply_payment_credit_once', {
      p_payment_id: params.paymentId,
      p_provider_payment_id: params.providerPaymentId ?? null,
      p_paid_at: params.paidAt ?? new Date().toISOString(),
      p_description: params.description,
      p_metadata: params.metadata ?? {},
      p_created_by: params.createdBy ?? null,
      p_raw_payload: params.rawPayload ?? {},
    })
    .single();

  assertSupabaseResult(error, 'Failed to apply payment wallet credit.');
  return paymentWalletMutationSchema.parse(data);
}

export function assertWalletSpendable(params: {
  walletStatus: WalletStatus;
  remainingSeconds: number;
  requiredSeconds: number;
  lockedMessage?: string;
  insufficientMessage?: string;
}) {
  if (params.walletStatus !== 'active') {
    throw new RouteError(403, 'wallet_locked', params.lockedMessage ?? 'Wallet access is locked.');
  }

  if (params.remainingSeconds < params.requiredSeconds) {
    throw new RouteError(402, 'insufficient_credits', params.insufficientMessage ?? 'Not enough credits remain for this action.');
  }
}

export interface PaymentWalletMutationResult {
  wallet_id: string;
  remaining_seconds: number;
  lifetime_seconds_purchased: number;
  lifetime_seconds_used: number;
  payment_status: PaymentStatus;
  credited: boolean;
}
