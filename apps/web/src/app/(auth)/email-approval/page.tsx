import type { Route } from 'next';
import { redirect } from 'next/navigation';

import { EmailApprovalCard } from '@/features/auth/email-approval';
import { requirePageUser } from '@/lib/auth/page-context';

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

  if (!context.emailTwoFactorEnabled) {
    redirect(nextPath);
  }

  return (
    <EmailApprovalCard
      currentEmail={context.authEmail}
      nextPath={nextPath}
      backPath={fallbackPath}
    />
  );
}
