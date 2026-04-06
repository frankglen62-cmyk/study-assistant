import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { UnifiedSettingsShell } from '@/features/account/unified-settings-shell';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await requirePageUser(['admin', 'super_admin']);
  const emailChangeStatus = Array.isArray(params['email-change']) ? params['email-change'][0] : params['email-change'];
  const pendingEmail = Array.isArray(params['pending-email']) ? params['pending-email'][0] : params['pending-email'];
  const defaultTab = emailChangeStatus === 'requested' || emailChangeStatus === 'confirmed' ? 'account' : undefined;

  return (
    <div className="space-y-6 pb-12">
      <PageHeading
        eyebrow="Admin"
        title="Settings"
        description="Manage your administrator account, security settings, appearance, and platform configuration."
      />

      <UnifiedSettingsShell
        variant="admin"
        defaultTab={defaultTab as any}
        profile={{
          fullName: context.profile.full_name,
          role: context.profile.role,
          email: context.authEmail,
          accountStatus: context.profile.account_status,
        }}
        security={{
          emailTwoFactorEnabled: context.emailTwoFactorEnabled,
          mfaEnabled: false,
          accountPath: '/admin/settings',
          emailChangeStatus: emailChangeStatus === 'requested' || emailChangeStatus === 'confirmed' ? emailChangeStatus : null,
          pendingEmail: pendingEmail ?? null,
        }}
        platformSettings={context.systemSettings}
      />
    </div>
  );
}
