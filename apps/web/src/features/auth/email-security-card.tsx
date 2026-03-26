'use client';

import { useState } from 'react';
import type { Route } from 'next';
import { ArrowRight, Loader2, Mail, ShieldCheck } from 'lucide-react';

import { Badge, Button, Input } from '@study-assistant/ui';

import { useToast } from '@/components/providers/toast-provider';
import { SettingRow } from '@/features/account/setting-row';

function getReadableError(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }
  const message = error.message.toLowerCase();
  if (message.includes('same email')) return 'Enter a different email address.';
  if (message.includes('invalid email')) return 'Enter a valid email address.';
  if (message.includes('already in use') || message.includes('email_taken')) {
    return 'That email address is already in use by another account.';
  }
  return error.message;
}

type EmailSecurityCardProps = {
  currentEmail: string;
  emailTwoFactorEnabled: boolean;
  accountPath: Route;
  emailChangeStatus?: 'requested' | 'confirmed' | null;
  pendingEmail?: string | null;
};

export function EmailSecurityCard({
  currentEmail,
  emailTwoFactorEnabled,
  accountPath,
  emailChangeStatus = null,
  pendingEmail = null,
}: EmailSecurityCardProps) {
  const { pushToast } = useToast();
  const normalizedCurrentEmail = currentEmail.trim().toLowerCase();
  const normalizedPendingEmail = pendingEmail?.trim().toLowerCase() ?? null;
  const showComparison = Boolean(normalizedPendingEmail && normalizedPendingEmail !== normalizedCurrentEmail);
  const [enabled, setEnabled] = useState(emailTwoFactorEnabled);
  const [workingMode, setWorkingMode] = useState<'toggle' | 'change' | null>(null);
  const [targetEmail, setTargetEmail] = useState('');

  const handleToggle = async (nextValue: boolean) => {
    setWorkingMode('toggle');
    try {
      const response = await fetch('/api/account/email-2fa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: nextValue }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to update email sign-in approval.');
      }

      setEnabled(nextValue);
      pushToast({
        tone: 'success',
        title: nextValue ? 'Email 2FA enabled' : 'Email 2FA disabled',
        description: nextValue
          ? 'Sign-ins will now require a 6-digit code.'
          : 'Sign-ins will no longer require a 6-digit code.',
      });
    } catch (error) {
      pushToast({ tone: 'danger', title: 'Update failed', description: getReadableError(error, 'Unable to update email 2FA.') });
    } finally {
      setWorkingMode(null);
    }
  };

  const handleEmailChange = async () => {
    if (!targetEmail.trim()) {
      pushToast({ tone: 'danger', title: 'Error', description: 'Enter the new email address first.' });
      return;
    }

    setWorkingMode('change');
    try {
      const requestResponse = await fetch('/api/account/email-change/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetEmail: targetEmail.trim(),
          next: accountPath,
        }),
      });

      const requestPayload = (await requestResponse.json().catch(() => null)) as { redirectTo?: string; error?: string } | null;
      if (!requestResponse.ok || !requestPayload?.redirectTo) {
        throw new Error(requestPayload?.error ?? 'Unable to start email change request.');
      }

      setTargetEmail('');
      pushToast({
        tone: 'success',
        title: 'Code sent',
        description: 'A 6-digit verification code was sent to your current email.',
      });
      window.location.assign(requestPayload.redirectTo);
    } catch (error) {
      pushToast({ tone: 'danger', title: 'Change failed', description: getReadableError(error, 'Unable to request an email change.') });
    } finally {
      setWorkingMode(null);
    }
  };

  return (
    <>
      <SettingRow
        icon={<ShieldCheck className="h-4 w-4 text-accent" />}
        title="Email 2-Factor Authentication"
        description="Require a 6-digit code sent to your inbox when signing in and before a protected email change can continue."
        status={
          <Badge tone={enabled ? 'success' : 'neutral'} className="text-xs">
            {enabled ? 'Active' : 'Off'}
          </Badge>
        }
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleToggle(!enabled)}
            disabled={workingMode === 'toggle'}
          >
            {workingMode === 'toggle' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {enabled ? 'Disable' : 'Enable'}
          </Button>
        }
      />

      <SettingRow
        icon={<Mail className="h-4 w-4 text-accent" />}
        title="Email Address"
        description="Used for sign-in, recovery, and security codes. Change your email below."
      >
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">Current email</p>
              <p className="mt-2 truncate text-base font-medium text-white">{currentEmail}</p>
            </div>

            {showComparison ? (
              <>
                <div className="flex items-center justify-center text-neutral-500">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">
                    {emailChangeStatus === 'confirmed' ? 'Confirmed email' : 'Pending new email'}
                  </p>
                  <p className="mt-2 truncate text-base font-medium text-white">{pendingEmail}</p>
                </div>
              </>
            ) : null}
          </div>

          {emailChangeStatus === 'requested' && pendingEmail ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
              <Badge tone="warning" className="mt-0.5 text-[10px] uppercase">Pending</Badge>
              <div className="space-y-1 text-sm text-neutral-300">
                <p className="font-medium text-white">Verification pending</p>
                <p>
                  Your current email was verified. We sent a confirmation button to
                  {' '}
                  <span className="font-medium text-white">{pendingEmail}</span>
                  {' '}
                  to finish the email change.
                </p>
              </div>
            </div>
          ) : null}

          {emailChangeStatus === 'confirmed' && pendingEmail ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
              <Badge tone="success" className="mt-0.5 text-[10px] uppercase">Verified</Badge>
              <div className="space-y-1 text-sm text-neutral-300">
                <p className="font-medium text-white">Email change confirmed</p>
                <p>
                  Your new sign-in email is now
                  {' '}
                  <span className="font-medium text-white">{pendingEmail}</span>
                  . Sign in with the new email if you were signed out during the update.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="new-email@example.com"
            className="h-10 w-full sm:w-64 bg-white/[0.04] border-white/10 text-sm"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleEmailChange}
            disabled={workingMode === 'change' || !targetEmail.trim()}
          >
            {workingMode === 'change' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Change Email
          </Button>
        </div>
      </SettingRow>
    </>
  );
}
