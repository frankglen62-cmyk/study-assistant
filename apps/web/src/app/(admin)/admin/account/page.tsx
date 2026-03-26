import Link from 'next/link';
import { Settings } from 'lucide-react';

import { Button } from '@study-assistant/ui';

import { PageHeading } from '@/components/page-heading';
import { LogoutButton } from '@/features/auth/logout-button';
import { AccountSettingsShell } from '@/features/account/account-settings-shell';
import { requirePageUser } from '@/lib/auth/page-context';

export default async function AdminAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await requirePageUser(['admin', 'super_admin']);
  const emailChangeStatus = Array.isArray(params['email-change']) ? params['email-change'][0] : params['email-change'];

  return (
    <div className="space-y-8 pb-12">
      <PageHeading
        eyebrow="Admin Account"
        title="Security & Account"
        description="Manage your administrator profile, security settings, and authentication methods."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/admin/settings">
                <Settings className="h-4 w-4" />
                Platform Settings
              </Link>
            </Button>
            <LogoutButton />
          </>
        }
      />

      <AccountSettingsShell
        variant="admin"
        profile={{
          fullName: context.profile.full_name,
          role: context.profile.role,
          email: context.authEmail,
          accountStatus: context.profile.account_status,
        }}
        security={{
          emailTwoFactorEnabled: context.emailTwoFactorEnabled,
          mfaEnabled: false,
          accountPath: '/admin/account',
          emailChangeStatus: emailChangeStatus === 'requested' || emailChangeStatus === 'confirmed' ? emailChangeStatus : null,
        }}
      />
    </div>
  );
}
