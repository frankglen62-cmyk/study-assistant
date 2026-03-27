import crypto from 'crypto';

import { getSupabaseAdmin } from '@/lib/supabase/server';
import { sendOtpEmail } from '@/lib/security/email-service';

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export type OtpPurpose = 'login_2fa' | 'email_change_current' | 'email_change_new' | 'sensitive_action';

type OtpDeliveryState = {
  step: 'initial' | 'code-sent';
  cooldownSeconds: number;
  errorMessage?: string;
};

/**
 * Generate a 6-digit OTP, store it hashed, and send it via email.
 * Enforces a 60-second resend cooldown.
 * Returns the cooldown info.
 */
export async function generateAndSendOtp(
  userId: string,
  email: string,
  purpose: OtpPurpose,
): Promise<{ sent: true; cooldownSeconds: number }> {
  const admin = getSupabaseAdmin();

  // Check cooldown — find the most recent code for this user+purpose
  const { data: recent } = await admin
    .from('otp_codes')
    .select('created_at')
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const elapsedSeconds = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      throw new Error(`Please wait ${remaining} seconds before requesting another code.`);
    }
  }

  // Invalidate all previous unused codes for this user+purpose
  await admin
    .from('otp_codes')
    .delete()
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .is('used_at', null);

  // Generate and store
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const { error: insertError } = await admin.from('otp_codes').insert({
    user_id: userId,
    email,
    code_hash: hashCode(code),
    purpose,
    max_attempts: MAX_ATTEMPTS,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    console.error('Failed to store OTP:', insertError);
    throw new Error('Unable to generate verification code.');
  }

  // Send the email
  await sendOtpEmail(email, code, purpose);

  return { sent: true, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
}

export async function ensureOtpDeliveryState(
  userId: string,
  email: string,
  purpose: OtpPurpose,
): Promise<OtpDeliveryState> {
  const admin = getSupabaseAdmin();
  const now = Date.now();

  const { data: recent } = await admin
    .from('otp_codes')
    .select('created_at, expires_at')
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const createdAt = new Date(recent.created_at).getTime();
    const expiresAt = new Date(recent.expires_at).getTime();
    const ageSeconds = (now - createdAt) / 1000;
    const cooldownSeconds = Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - ageSeconds));

    if (expiresAt > now) {
      return {
        step: 'code-sent',
        cooldownSeconds,
      };
    }
  }

  try {
    const result = await generateAndSendOtp(userId, email, purpose);
    return {
      step: 'code-sent',
      cooldownSeconds: result.cooldownSeconds,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unable to send verification code. Please try again.';

    return {
      step: 'initial',
      cooldownSeconds: 0,
      errorMessage,
    };
  }
}

/**
 * Verify a 6-digit OTP code.
 * Checks hash, enforces max attempts, checks expiry.
 * Marks code as used on success.
 */
export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
): Promise<{ verified: true }> {
  const admin = getSupabaseAdmin();

  // Find the latest unused, non-expired code
  const { data: otpRecord, error: findError } = await admin
    .from('otp_codes')
    .select('*')
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError || !otpRecord) {
    throw new Error('No valid verification code found. Please request a new one.');
  }

  if (otpRecord.attempts >= otpRecord.max_attempts) {
    // Delete the exhausted code
    await admin.from('otp_codes').delete().eq('id', otpRecord.id);
    throw new Error('Too many failed attempts. Please request a new code.');
  }

  // Increment attempts
  await admin
    .from('otp_codes')
    .update({ attempts: otpRecord.attempts + 1 })
    .eq('id', otpRecord.id);

  // Check hash
  if (otpRecord.code_hash !== hashCode(code)) {
    const remaining = otpRecord.max_attempts - (otpRecord.attempts + 1);
    throw new Error(
      remaining > 0
        ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many failed attempts. Please request a new code.',
    );
  }

  // Mark as used
  await admin
    .from('otp_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', otpRecord.id);

  return { verified: true };
}
