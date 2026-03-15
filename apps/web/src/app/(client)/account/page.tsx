import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@study-assistant/ui';
import { Mail, User, Clock, LaptopIcon, ShieldAlert, KeyRound, AlertTriangle } from 'lucide-react';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { LogoutButton } from '@/features/auth/logout-button';
import { ExtensionInstallFlow } from '@/features/client/extension-install-flow';
import { PairExtensionCard } from '@/features/client/pair-extension-card';
import { RevokeDeviceButton } from '@/features/client/revoke-device-button';
import { getClientAccountData } from '@/features/client/server';
import { requirePageUser } from '@/lib/auth/page-context';
import { env } from '@/lib/env/server';

export default async function AccountPage() {
  const context = await requirePageUser(['client']);
  const account = await getClientAccountData(context.userId);

  return (
    <div className="space-y-8 pb-12">
      <PageHeading
        eyebrow="Account"
        title="Account Settings"
        description="Manage your profile, active sessions, billing history, and paired study devices."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/settings">Preferences</Link>
            </Button>
            <LogoutButton />
          </>
        }
      />
      
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>Your personal information and account status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 rounded-xl border border-border/50 bg-background/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                  <User className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium">{context.profile.full_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">Role: {context.profile.role.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{context.profile.email}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success inline-block"></span> Verified
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Account Status</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success inline-block"></span> {context.profile.account_status.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild variant="secondary" className="w-full justify-start gap-2">
                <Link href="/forgot-password"><KeyRound className="h-4 w-4" /> Change Password</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <ExtensionInstallFlow compact={!account.devices.length} showActions pairedDeviceCount={account.devices.length} />

          <Card id="paired-devices">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Paired Extensions</CardTitle>
                  <CardDescription>Devices currently authorized to consume credits.</CardDescription>
                </div>
                <Badge tone="neutral" className="gap-1.5">
                  <LaptopIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {account.devices.length} Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {account.devices.length > 0 ? (
                account.devices.map((device) => (
                  <div key={device.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[22px] border border-border/70 bg-gradient-to-r from-background/60 to-surface/40 px-5 py-4">
                    <div className="flex items-start gap-4">
                      <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 mt-1">
                        <LaptopIcon className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{device.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono bg-muted/50 inline-block px-1.5 py-0.5 rounded">{device.version}</p>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> Last seen: {device.lastSeen}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <StatusBadge status={device.status} />
                      <RevokeDeviceButton installationId={device.id} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-border/70 bg-background/40 px-6 py-10 text-center flex flex-col items-center justify-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-warning" />
                  <div>
                    <p className="text-sm font-medium">No extensions paired yet</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">Generate a pairing code below and enter it into the Chrome extension to connect your account.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {account.devices.length === 0 ? (
            <PairExtensionCard
              appBaseUrl={env.NEXT_PUBLIC_APP_URL}
              initialDeviceName={`${context.profile.full_name.split(' ')[0] || 'My'} Study Device`}
              pairedDeviceCount={account.devices.length}
            />
          ) : null}
        </div>
      </div>
      <div className="space-y-4 mt-8">
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
