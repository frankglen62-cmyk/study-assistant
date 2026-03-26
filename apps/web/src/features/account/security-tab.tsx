'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { KeyRound, Mail, ShieldCheck, Info } from 'lucide-react';

import { Badge, Button } from '@study-assistant/ui';

import { EmailSecurityCard } from '@/features/auth/email-security-card';
import { MfaSecurityCard } from '@/features/auth/mfa';
import { SecurityOverview } from '@/features/account/security-overview';
import { SettingRow } from '@/features/account/setting-row';

export function SecurityTab({
  currentEmail,
  emailTwoFactorEnabled,
  mfaEnabled,
  activeDeviceCount,
  accountPath,
  emailChangeStatus,
}: {
  currentEmail: string;
  emailTwoFactorEnabled: boolean;
  mfaEnabled: boolean;
  activeDeviceCount: number;
  accountPath: Route;
  emailChangeStatus: 'requested' | 'confirmed' | null;
}) {
  return (
    <div className="space-y-6">
      <SecurityOverview
        emailTwoFactorEnabled={emailTwoFactorEnabled}
        mfaEnabled={mfaEnabled}
        activeDeviceCount={activeDeviceCount}
      />

      <SettingRow
        icon={<KeyRound className="h-4 w-4 text-accent" />}
        title="Password"
        description="Update your password to keep your account secure."
        status={<Badge tone="success" className="text-xs">Active</Badge>}
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
      />

      <MfaSecurityCard />

      <SettingRow
        icon={<Info className="h-4 w-4 text-accent" />}
        title="Sensitive Action Verification"
        description="If Email 2FA or an authenticator app is enabled, sign-in and sensitive account changes can require one more approval step before they continue."
      />
    </div>
  );
}
