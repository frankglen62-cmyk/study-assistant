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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-black/5">
        {icon}
      </div>
      <div className="flex flex-1 items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">{label}</span>
        <Badge tone={tone} className="border-black">{value}</Badge>
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
    <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
      <div className="mb-6 flex items-center gap-3">
        <Shield className="h-5 w-5 text-black" />
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-black">Security Overview</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <OverviewItem
          icon={<KeyRound className="h-4 w-4 text-black" />}
          label="Password"
          value="Active"
          tone="success"
        />
        <OverviewItem
          icon={<Mail className="h-4 w-4 text-black" />}
          label="Primary Email"
          value={emailVerified ? 'Verified' : 'Not verified'}
          tone={emailVerified ? 'success' : 'warning'}
        />
        <OverviewItem
          icon={<Mail className="h-4 w-4 text-black" />}
          label="Email 2FA"
          value={emailTwoFactorEnabled ? 'On' : 'Off'}
          tone={emailTwoFactorEnabled ? 'success' : 'neutral'}
        />
        <OverviewItem
          icon={<Smartphone className="h-4 w-4 text-black" />}
          label="Authenticator App"
          value={mfaEnabled ? 'Connected' : 'Not connected'}
          tone={mfaEnabled ? 'success' : 'neutral'}
        />
        <OverviewItem
          icon={<Monitor className="h-4 w-4 text-black" />}
          label="Active Devices"
          value={String(activeDeviceCount)}
          tone={activeDeviceCount > 0 ? 'success' : 'neutral'}
        />
      </div>
    </div>
  );
}
