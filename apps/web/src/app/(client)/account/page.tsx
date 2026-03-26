import Link from 'next/link';

import { Button, Card } from '@study-assistant/ui';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { LogoutButton } from '@/features/auth/logout-button';
import { AccountSettingsShell } from '@/features/account/account-settings-shell';
import { getClientAccountData } from '@/features/client/server';
import { requirePageUser } from '@/lib/auth/page-context';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await requirePageUser(['client']);
  const account = await getClientAccountData(context.userId);
  const latestDevice = account.devices[0] ?? null;
  const emailChangeStatus = Array.isArray(params['email-change']) ? params['email-change'][0] : params['email-change'];

  return (
    <div className="space-y-8 pb-12">
      <PageHeading
        eyebrow="Account"
        title="Account Settings"
        description="Manage your profile, security, and paired study devices."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/settings">Preferences</Link>
            </Button>
            <LogoutButton />
          </>
        }
      />

      <AccountSettingsShell
        variant="client"
        profile={{
          fullName: context.profile.full_name,
          role: context.profile.role,
          email: context.authEmail,
          accountStatus: context.profile.account_status,
        }}
        security={{
          emailTwoFactorEnabled: context.emailTwoFactorEnabled,
          mfaEnabled: false,
          accountPath: '/account',
          emailChangeStatus: emailChangeStatus === 'requested' || emailChangeStatus === 'confirmed' ? emailChangeStatus : null,
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
      />

      <div className="space-y-4">
        <h3 className="text-lg font-medium tracking-tight">Billing History</h3>
        <Card className="overflow-hidden">
          <DataTable
            columns={['Date', 'Package', 'Provider', 'Amount', 'Status']}
            emptyMessage="No billing history yet."
            rows={account.paymentHistory.map((payment) => [
              payment.date,
              payment.package,
              payment.provider,
              payment.amount,
              <StatusBadge key={`${payment.id}-status`} status={payment.status} />,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
