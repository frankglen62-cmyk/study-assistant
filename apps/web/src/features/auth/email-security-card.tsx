'use client';

import { useMemo, useState } from 'react';
import type { Route } from 'next';
import { ArrowRight, Loader2, Mail, ShieldCheck } from 'lucide-react';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@study-assistant/ui';

import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/providers/toast-provider';
import { CaptchaWidget } from '@/features/auth/captcha-widget';
import { env } from '@/lib/env/client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

function getReadableError(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const message = error.message.toLowerCase();
  if (message.includes('captcha')) {
    return 'Complete the security check first.';
  }
  if (message.includes('same email')) {
    return 'Enter a different email address.';
  }
  if (message.includes('invalid email')) {
    return 'Enter a valid email address.';
  }

  return error.message;
}

function useCaptchaState() {
  const captchaEnabled = Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const ensureCaptcha = () => {
    if (!captchaEnabled) {
      return true;
    }

    if (captchaToken) {
      return true;
    }

    setCaptchaError('Complete the security check first.');
    return false;
  };

  const resetCaptcha = () => {
    if (!captchaEnabled) {
      return;
    }

    setCaptchaToken(null);
    setCaptchaResetKey((value) => value + 1);
  };

  return {
    captchaEnabled,
    captchaError,
    captchaResetKey,
    captchaToken,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaToken,
  };
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
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [emailChangeNotice, setEmailChangeNotice] = useState<string | null>(
    emailChangeStatus === 'requested'
      ? 'Approval email sent. Open the link sent to your current email first, then confirm the secure email change emails that follow.'
      : emailChangeStatus === 'confirmed'
        ? 'Your new email has been confirmed. Use it on your next sign-in.'
        : null,
  );
  const {
    captchaError,
    captchaResetKey,
    captchaToken,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaToken,
  } = useCaptchaState();

  const toggleLabel = useMemo(
    () => (enabled ? 'Sign-in and secure email updates require approval through your current inbox.' : 'Password or social sign-in will continue directly unless your inbox needs approval for an email change.'),
    [enabled],
  );

  const handleToggle = async (nextValue: boolean) => {
    setToggleError(null);
    setWorkingMode('toggle');

    try {
      const response = await fetch('/api/account/email-2fa', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
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
          ? 'Future sign-ins and protected email actions will require approval through your current inbox.'
          : 'Password and social sign-ins will no longer pause for inbox approval.',
      });
    } catch (error) {
      const message = getReadableError(error, 'Unable to update email 2FA.');
      setToggleError(message);
      pushToast({ tone: 'danger', title: 'Update failed', description: message });
    } finally {
      setWorkingMode(null);
    }
  };

  const handleEmailChange = async () => {
    setChangeError(null);
    setEmailChangeNotice(null);

    if (!targetEmail.trim()) {
      setChangeError('Enter the new email address first.');
      return;
    }

    if (!ensureCaptcha()) {
      return;
    }

    setWorkingMode('change');

    try {
      const requestResponse = await fetch('/api/account/email-change/request', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          targetEmail: targetEmail.trim(),
          next: accountPath,
        }),
      });

      const requestPayload = (await requestResponse.json().catch(() => null)) as { redirectTo?: string; error?: string } | null;
      if (!requestResponse.ok || !requestPayload?.redirectTo) {
        throw new Error(requestPayload?.error ?? 'Unable to start the secure email change request.');
      }

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: currentEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: requestPayload.redirectTo,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });

      if (error) {
        throw error;
      }

      setTargetEmail('');
      setEmailChangeNotice(enabled
        ? 'A verification email was sent to your current inbox. Approve it there first before the new email can replace this one.'
        : 'A secure confirmation email was sent. Approve it from your current inbox to continue the email update.');
      pushToast({
        tone: 'success',
        title: 'Email change started',
        description: 'Check your current inbox first before the email change can continue.',
      });
    } catch (error) {
      const message = getReadableError(error, 'Unable to request an email change.');
      setChangeError(message);
      resetCaptcha();
      pushToast({ tone: 'danger', title: 'Email change failed', description: message });
    } finally {
      setWorkingMode(null);
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Email 2-Factor Authentication</CardTitle>
        <CardDescription>Protect sign-ins and important email changes with one more approval step through your current inbox.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Primary email</p>
            <p className="mt-2 text-base font-semibold text-foreground break-all">{currentEmail}</p>
            <p className="mt-2 text-sm text-muted-foreground">This inbox receives sign-in approvals, secure email-change approvals, and account recovery messages.</p>
          </div>
          <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Email 2FA</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{enabled ? 'Enabled' : 'Disabled'}</p>
            <p className="mt-2 text-sm text-muted-foreground">{toggleLabel}</p>
          </div>
        </div>

        {toggleError ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{toggleError}</div> : null}
        {emailChangeNotice ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{emailChangeNotice}</div> : null}
        {changeError ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{changeError}</div> : null}

        <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <ShieldCheck className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Email 2-Factor Authentication</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Turn this on to require inbox approval after password or social sign-in. It also keeps secure email updates tied to your registered inbox.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => handleToggle(!enabled)}
                  disabled={workingMode === 'toggle'}
                >
                  {workingMode === 'toggle' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {enabled ? 'Disable Email 2FA' : 'Enable Email 2FA'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Change sign-in email</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the new email you want to use. Before it changes, your current inbox must approve the request.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Email change flow</p>
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Current email</p>
                  <p className="mt-2 truncate text-sm font-semibold text-foreground">{currentEmail}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <FormField label="New email" description="Use an inbox you control. We will not replace the current email until approval is completed.">
                    <Input
                      value={targetEmail}
                      onChange={(event) => setTargetEmail(event.target.value)}
                      placeholder="new-email@example.com"
                      className="h-12 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-neutral-600 focus:border-teal-500/50 focus:ring-teal-500/20"
                    />
                  </FormField>
                </div>
              </div>
            </div>

            <CaptchaWidget
              action="email-change"
              resetKey={captchaResetKey}
              error={captchaError}
              onTokenChange={setCaptchaToken}
            />

            <Button type="button" onClick={handleEmailChange} disabled={workingMode === 'change'}>
              {workingMode === 'change' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Change Email
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
