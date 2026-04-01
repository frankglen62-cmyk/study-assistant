import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { UnifiedSettingsShell } from '@/features/account/unified-settings-shell';
import { getClientAccountData, getClientSettingsData, getClientBillingData } from '@/features/client/server';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await requirePageUser(['client']);
  const [account, settings, billing] = await Promise.all([
    getClientAccountData(context.userId),
    getClientSettingsData(context.userId),
    getClientBillingData(context.userId),
  ]);

  const latestDevice = account.devices[0] ?? null;
  const emailChangeStatus = Array.isArray(params['email-change']) ? params['email-change'][0] : params['email-change'];
  const pendingEmail = Array.isArray(params['pending-email']) ? params['pending-email'][0] : params['pending-email'];
  const defaultTab = emailChangeStatus === 'requested' || emailChangeStatus === 'confirmed' ? 'account' : undefined;

  return (
    <div className="space-y-6 pb-12">
      <PageHeading
        eyebrow="Preferences & Account"
        title="Settings"
        description="Manage your account, security, billing, appearance, devices, and extension preferences."
      />

      <UnifiedSettingsShell
        variant="client"
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
          accountPath: '/settings',
          emailChangeStatus: emailChangeStatus === 'requested' || emailChangeStatus === 'confirmed' ? emailChangeStatus : null,
          pendingEmail: pendingEmail ?? null,
        }}
        devices={account.devices}
        extensionData={{
          pairedCount: account.devices.length,
          latestDevice: latestDevice
            ? {
                name: latestDevice.name,
                version: latestDevice.version,
                lastSeen: latestDevice.lastSeen,
              }
            : null,
        }}
        wallet={context.wallet}
        paymentHistory={billing.paymentHistory}
        clientSettings={settings}
      />
    </div>
  );
}
