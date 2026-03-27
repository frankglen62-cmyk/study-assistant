import type { Route } from 'next';
import { redirect } from 'next/navigation';

import { EmailApprovalCard } from '@/features/auth/email-approval';
import { requirePageUser } from '@/lib/auth/page-context';
import { ensureOtpDeliveryState } from '@/lib/security/otp-service';

type VerificationPurpose = 'login_2fa' | 'email_change_current';

function getSafeNextPath(candidate: string | string[] | undefined, fallback: Route) {
  const value = Array.isArray(candidate) ? candidate[0] : candidate;
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  return value as Route;
}

export default async function EmailApprovalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await requirePageUser(['client', 'admin', 'super_admin']);
  const fallbackPath: Route = context.profile.role === 'client' ? '/dashboard' : '/admin/dashboard';
  const nextPath = getSafeNextPath(params.next, fallbackPath);
  const rawPurpose = Array.isArray(params.purpose) ? params.purpose[0] : params.purpose;
  const purpose: VerificationPurpose = rawPurpose === 'email_change_current' ? 'email_change_current' : 'login_2fa';
  const sent = (Array.isArray(params.sent) ? params.sent[0] : params.sent) === '1';
  const cooldownValue = Array.isArray(params.cooldown) ? params.cooldown[0] : params.cooldown;
  const parsedCooldown = Number.parseInt(cooldownValue ?? '0', 10);

  if (purpose === 'login_2fa' && !context.emailTwoFactorEnabled) {
    redirect(nextPath);
  }

  const otpState =
    purpose === 'login_2fa'
      ? await ensureOtpDeliveryState(context.userId, context.authEmail, 'login_2fa')
      : {
          step: sent ? ('code-sent' as const) : ('initial' as const),
          cooldownSeconds: Number.isFinite(parsedCooldown) && parsedCooldown > 0 ? parsedCooldown : 0,
          errorMessage: undefined as string | undefined,
        };

  return (
    <EmailApprovalCard
      currentEmail={context.authEmail}
      nextPath={nextPath}
      backPath={fallbackPath}
      purpose={purpose}
      initialStep={otpState.step}
      initialCooldown={otpState.cooldownSeconds}
      initialErrorMessage={otpState.errorMessage}
    />
  );
}
