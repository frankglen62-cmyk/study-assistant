'use client';

import { useState } from 'react';
import type { Route } from 'next';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';

import { Badge, Button, Input } from '@study-assistant/ui';

import { useToast } from '@/components/providers/toast-provider';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { SettingRow } from '@/features/account/setting-row';

function getReadableError(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }
  const message = error.message.toLowerCase();
  if (message.includes('same email')) return 'Enter a different email address.';
  if (message.includes('invalid email')) return 'Enter a valid email address.';
  return error.message;
}

type EmailSecurityCardProps = {
  currentEmail: string;
  emailTwoFactorEnabled: boolean;
  accountPath: Route;
  emailChangeStatus?: 'requested' | 'confirmed' | null;
};

export function EmailSecurityCard({
  currentEmail,
  emailTwoFactorEnabled,
  accountPath,
  emailChangeStatus = null,
}: EmailSecurityCardProps) {
  const { pushToast } = useToast();
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

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: currentEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: requestPayload.redirectTo,
        },
      });

      if (error) throw error;

      setTargetEmail('');
      pushToast({
        tone: 'success',
        title: 'Verification Sent',
        description: 'Check your current inbox to approve this change.',
      });
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
        description="Require a 6-digit code sent to your inbox when signing in."
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
        <span className="mb-4 block text-white font-medium">{currentEmail}</span>
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
