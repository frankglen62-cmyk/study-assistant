'use client';

import { KeyRound, Mail, Smartphone, Shield, Monitor } from 'lucide-react';

import { Badge } from '@study-assistant/ui';

function OverviewItem({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground">
        {icon}
      </div>
      <div className="flex flex-1 items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge tone={tone}>{value}</Badge>
      </div>
    </div>
  );
}

export function SecurityOverview({
  emailVerified = true,
  emailTwoFactorEnabled,
  mfaEnabled,
  activeDeviceCount,
}: {
  emailVerified?: boolean;
  emailTwoFactorEnabled: boolean;
  mfaEnabled: boolean;
  activeDeviceCount: number;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-card">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <Shield className="h-4 w-4 text-accent" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Security Overview</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <OverviewItem
          icon={<KeyRound className="h-4 w-4" />}
          label="Password"
          value="Active"
          tone="success"
        />
        <OverviewItem
          icon={<Mail className="h-4 w-4" />}
          label="Primary Email"
          value={emailVerified ? 'Verified' : 'Not verified'}
          tone={emailVerified ? 'success' : 'warning'}
        />
        <OverviewItem
          icon={<Mail className="h-4 w-4" />}
          label="Email 2FA"
          value={emailTwoFactorEnabled ? 'On' : 'Off'}
          tone={emailTwoFactorEnabled ? 'success' : 'neutral'}
        />
        <OverviewItem
          icon={<Smartphone className="h-4 w-4" />}
          label="Authenticator App"
          value={mfaEnabled ? 'Connected' : 'Not connected'}
          tone={mfaEnabled ? 'success' : 'neutral'}
        />
        <OverviewItem
          icon={<Monitor className="h-4 w-4" />}
          label="Active Devices"
          value={String(activeDeviceCount)}
          tone={activeDeviceCount > 0 ? 'success' : 'neutral'}
        />
      </div>
    </div>
  );
}
