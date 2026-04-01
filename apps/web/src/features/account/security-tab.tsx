'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { KeyRound, Mail, Info, Laptop, MonitorSmartphone } from 'lucide-react';

import { Badge, Button } from '@study-assistant/ui';

import { EmailSecurityCard } from '@/features/auth/email-security-card';
import { MfaSecurityCard } from '@/features/auth/mfa';
import { SettingRow } from '@/features/account/setting-row';

type ActiveDevice = {
  id: string;
  name: string;
  version: string;
  lastSeen: string;
};

export function SecurityTab({
  currentEmail,
  emailTwoFactorEnabled,
  mfaEnabled,
  activeDevices,
  accountPath,
  emailChangeStatus,
  pendingEmail,
}: {
  currentEmail: string;
  emailTwoFactorEnabled: boolean;
  mfaEnabled: boolean;
  activeDevices: ActiveDevice[];
  accountPath: Route;
  emailChangeStatus: 'requested' | 'confirmed' | null;
  pendingEmail: string | null;
}) {
  return (
    <div className="space-y-6">
      <SettingRow
        icon={<KeyRound className="h-4 w-4 text-accent" />}
        title="Password"
        description="Update your password to keep your account secure."
        status={<Badge tone="success" className="h-5 rounded-md px-1.5 text-[10px] uppercase">Active</Badge>}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/forgot-password">Change Password</Link>
          </Button>
        }
      />

      <EmailSecurityCard
        currentEmail={currentEmail}
        emailTwoFactorEnabled={emailTwoFactorEnabled}
        accountPath={accountPath}
        emailChangeStatus={emailChangeStatus}
        pendingEmail={pendingEmail}
      />

      <MfaSecurityCard />

      <SettingRow
        icon={<MonitorSmartphone className="h-4 w-4 text-accent" />}
        title="Active Devices"
        description="Devices currently logged into your account or paired with the extension."
      >
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/40 bg-surface shadow-sm max-w-2xl">
          {activeDevices.length > 0 ? (
            <div className="divide-y divide-border/40">
              {activeDevices.map((device) => (
                <div key={device.id} className="flex items-center gap-4 p-4 text-sm text-foreground">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <Laptop className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{device.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">Last active: {new Date(device.lastSeen).toLocaleDateString()}</p>
                  </div>
                  <Badge tone="success" className="shrink-0 h-5 px-1.5 text-[10px] uppercase">Active</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm font-medium text-foreground">No active devices</p>
              <p className="mt-1 text-xs text-muted-foreground">You don't have any devices paired right now.</p>
            </div>
          )}
        </div>
      </SettingRow>

      <SettingRow
        icon={<Info className="h-4 w-4 text-accent" />}
        title="Sensitive Action Verification"
        description="If Email 2FA or an authenticator app is enabled, sign-in and sensitive account changes can require one more approval step before they continue."
      />
    </div>
  );
}
