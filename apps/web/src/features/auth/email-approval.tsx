'use client';

import { useMemo, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';

import { Button } from '@study-assistant/ui';

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
    captchaError,
    captchaResetKey,
    captchaToken,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaToken,
  };
}

type EmailApprovalCardProps = {
  currentEmail: string;
  nextPath: string;
  backPath: Route;
};

export function EmailApprovalCard({ currentEmail, nextPath, backPath }: EmailApprovalCardProps) {
  const { pushToast } = useToast();
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { captchaError, captchaResetKey, captchaToken, ensureCaptcha, resetCaptcha, setCaptchaToken } = useCaptchaState();

  const buttonLabel = useMemo(() => (isWorking ? 'Sending approval email...' : 'Send approval email'), [isWorking]);

  const handleSend = async () => {
    setErrorMessage(null);
    setNotice(null);

    if (!ensureCaptcha()) {
      return;
    }

    setIsWorking(true);
    try {
      const requestResponse = await fetch('/api/auth/email-approval/request', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          next: nextPath,
        }),
      });

      const requestPayload = (await requestResponse.json().catch(() => null)) as { redirectTo?: string; error?: string } | null;
      if (!requestResponse.ok || !requestPayload?.redirectTo) {
        throw new Error(requestPayload?.error ?? 'Unable to start email approval.');
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

      const message = 'Approval email sent. Open the latest email we sent to finish sign-in.';
      setNotice(message);
      pushToast({ tone: 'success', title: 'Approval email sent', description: message });
    } catch (error) {
      const message = getReadableError(error, 'Unable to send the email approval request.');
      setErrorMessage(message);
      resetCaptcha();
      pushToast({ tone: 'danger', title: 'Approval failed', description: message });
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-8 shadow-2xl shadow-black/30">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Approve Sign-In</h2>
        <p className="mt-1 text-sm text-neutral-500">Your account uses email-based sign-in approval. We will send a secure approval email to your inbox before you continue.</p>
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
              <ShieldCheck className="h-5 w-5 text-teal-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Approval email destination</p>
              <p className="mt-1 text-sm text-neutral-400">{currentEmail}</p>
              <p className="mt-2 text-sm text-neutral-500">Open the latest approval email on this inbox. Clicking the secure link will finish the sign-in flow.</p>
            </div>
          </div>
        </div>

        {notice ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div> : null}
        {errorMessage ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{errorMessage}</div> : null}

        <CaptchaWidget
          action="email-approval"
          resetKey={captchaResetKey}
          error={captchaError}
          onTokenChange={setCaptchaToken}
        />

        <Button type="button" className="h-12 w-full" onClick={handleSend} disabled={isWorking}>
          {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {buttonLabel}
        </Button>

        <div className="flex items-center justify-between gap-3 text-sm">
          <Link href={backPath} className="text-neutral-500 transition-colors hover:text-white">
            Back
          </Link>
          <button type="button" className="font-medium text-teal-400 transition-colors hover:text-teal-300" onClick={handleSend} disabled={isWorking}>
            Resend email
          </button>
        </div>
      </div>
    </div>
  );
}
