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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
        {icon}
      </div>
      <div className="flex flex-1 items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge tone={tone} className="text-xs">{value}</Badge>
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
    <div className="rounded-2xl border border-border/50 bg-background/30 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-medium text-foreground">Security Overview</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <OverviewItem
          icon={<KeyRound className="h-4 w-4 text-muted-foreground" />}
          label="Password"
          value="Active"
          tone="success"
        />
        <OverviewItem
          icon={<Mail className="h-4 w-4 text-muted-foreground" />}
          label="Email"
          value={emailVerified ? 'Verified' : 'Not verified'}
          tone={emailVerified ? 'success' : 'warning'}
        />
        <OverviewItem
          icon={<Mail className="h-4 w-4 text-muted-foreground" />}
          label="Email Verification"
          value={emailTwoFactorEnabled ? 'On' : 'Off'}
          tone={emailTwoFactorEnabled ? 'success' : 'neutral'}
        />
        <OverviewItem
          icon={<Smartphone className="h-4 w-4 text-muted-foreground" />}
          label="Authenticator App"
          value={mfaEnabled ? 'Connected' : 'Not connected'}
          tone={mfaEnabled ? 'success' : 'neutral'}
        />
        <OverviewItem
          icon={<Monitor className="h-4 w-4 text-muted-foreground" />}
          label="Active Devices"
          value={String(activeDeviceCount)}
          tone={activeDeviceCount > 0 ? 'success' : 'neutral'}
        />
      </div>
    </div>
  );
}
