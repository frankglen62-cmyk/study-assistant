'use client';

import { useState } from 'react';
import type { Route } from 'next';
import {
  Mail,
  User,
  Clock,
  ShieldCheck,
  KeyRound,
  MonitorSmartphone,
  Laptop,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react';

import { Badge, Button } from '@study-assistant/ui';
import { useToast } from '@/components/providers/toast-provider';
import { ChangePasswordModal } from '@/features/account/change-password-modal';
import { ChangeEmailModal } from '@/features/account/change-email-modal';
import { MfaSecurityCard } from '@/features/auth/mfa';

type ActiveDevice = {
  id: string;
  name: string;
  version: string;
  lastSeen: string;
  status: string;
};

type AccountSettingsTabProps = {
  profile: {
    fullName: string;
    role: string;
    email: string;
    accountStatus: string;
  };
  security: {
    emailTwoFactorEnabled: boolean;
    mfaEnabled: boolean;
    accountPath: Route;
    emailChangeStatus: 'requested' | 'confirmed' | null;
    pendingEmail: string | null;
  };
  activeDevices: ActiveDevice[];
};

export function AccountSettingsTab({ profile, security, activeDevices }: AccountSettingsTabProps) {
  const { pushToast } = useToast();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTwoFAEnabled, setEmailTwoFAEnabled] = useState(security.emailTwoFactorEnabled);
  const [isTogglingEmail2FA, setIsTogglingEmail2FA] = useState(false);

  const initials = profile.fullName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function handleToggleEmail2FA() {
    const nextValue = !emailTwoFAEnabled;
    setIsTogglingEmail2FA(true);
    try {
      const res = await fetch('/api/account/email-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextValue }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? 'Unable to update.');
      setEmailTwoFAEnabled(nextValue);
      pushToast({
        tone: 'success',
        title: nextValue ? 'Email 2FA enabled' : 'Email 2FA disabled',
        description: nextValue
          ? 'Sign-ins will now require a 6-digit code.'
          : 'Sign-ins will no longer require a 6-digit code.',
      });
    } catch (err) {
      pushToast({
        tone: 'danger',
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Unable to update email 2FA.',
      });
    } finally {
      setIsTogglingEmail2FA(false);
    }
  }

  return (
    <>
      <div className="space-y-8">
        {/* ─── Profile Information ─── */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-1">Profile Information</h3>
          <p className="text-xs text-muted-foreground mb-5">Manage your personal details and keep your contact info up to date.</p>

          <div className="rounded-2xl border border-border/40 bg-background p-6 shadow-card">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-xl font-semibold text-accent">
                {initials}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <h2 className="text-xl font-semibold text-foreground">{profile.fullName}</h2>
                  <Badge tone="accent" className="capitalize">
                    {profile.role.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Email Address</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-foreground">{profile.email}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        Verified
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Account Status</p>
                    <div className="mt-1 flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-foreground capitalize">{profile.accountStatus.replace('_', ' ')}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Display Name</p>
                    <p className="mt-1 text-sm text-foreground">{profile.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Role</p>
                    <p className="mt-1 text-sm text-foreground capitalize">{profile.role.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Security ─── */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-1">Security</h3>
          <p className="text-xs text-muted-foreground mb-5">Keep your account secure with extra authentication and alerts.</p>

          <div className="space-y-3">
            {/* Email 2FA Toggle */}
            <div className="rounded-xl border border-border/40 bg-background p-5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                    <Badge tone={emailTwoFAEnabled ? 'success' : 'neutral'} className="text-[10px] uppercase h-5 px-1.5">{emailTwoFAEnabled ? 'Active' : 'Off'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Add an extra layer of protection to your account.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleEmail2FA}
                disabled={isTogglingEmail2FA}
                className="shrink-0 text-accent transition-transform hover:scale-110 disabled:opacity-50"
                aria-label="Toggle email 2FA"
              >
                {isTogglingEmail2FA ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : emailTwoFAEnabled ? (
                  <ToggleRight className="h-7 w-7" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Password */}
            <div className="rounded-xl border border-border/40 bg-background p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Password</p>
                      <Badge tone="success" className="text-[10px] uppercase h-5 px-1.5">Active</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Update your password to keep your account secure.</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setPasswordModalOpen(true)}>
                  Change Password
                </Button>
              </div>
            </div>

            {/* Email Change */}
            <div className="rounded-xl border border-border/40 bg-background p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Email Address</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Change the email used for sign-in and notifications.</p>
                    <p className="mt-1 text-xs text-foreground">{profile.email}</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEmailModalOpen(true)}>
                  Change Email
                </Button>
              </div>

              {/* Pending email change status */}
              {security.emailChangeStatus === 'requested' && security.pendingEmail && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <Badge tone="warning" className="mt-0.5 text-[10px] uppercase">Pending</Badge>
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    Verification sent to <span className="font-medium">{security.pendingEmail}</span>. Click the link in both emails to finish the change.
                  </p>
                </div>
              )}
            </div>

            {/* Authenticator App */}
            <MfaSecurityCard />

            {/* Active Devices */}
            <div className="rounded-xl border border-border/40 bg-background p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <MonitorSmartphone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Active Devices</p>
                  <p className="mt-1 text-xs text-muted-foreground">Devices currently logged into your account or paired with the extension.</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border/40 bg-surface/30">
                {activeDevices.length > 0 ? (
                  <div className="divide-y divide-border/40">
                    {activeDevices.map((device) => (
                      <div key={device.id} className="flex items-center gap-4 p-4 text-sm text-foreground">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
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
                    <p className="mt-1 text-xs text-muted-foreground">You don&apos;t have any devices paired right now.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Modals */}
      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
      <ChangeEmailModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        currentEmail={profile.email}
        accountPath={security.accountPath}
      />
    </>
  );
}
