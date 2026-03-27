'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';

import { Button, Input } from '@study-assistant/ui';

import { useToast } from '@/components/providers/toast-provider';

type VerificationPurpose = 'login_2fa' | 'email_change_current';
type ApprovalStep = 'initial' | 'code-sent';

type EmailApprovalCardProps = {
  currentEmail: string;
  nextPath: string;
  backPath: Route;
  purpose?: VerificationPurpose;
  initialStep?: ApprovalStep;
  initialCooldown?: number;
  initialErrorMessage?: string;
};

export function EmailApprovalCard({
  currentEmail,
  nextPath,
  backPath,
  purpose = 'login_2fa',
  initialStep = 'initial',
  initialCooldown = 0,
  initialErrorMessage = '',
}: EmailApprovalCardProps) {
  const { pushToast } = useToast();
  const [step, setStep] = useState<ApprovalStep>(initialStep);
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage || null);
  const [cooldown, setCooldown] = useState(initialCooldown);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'code-sent') {
      return;
    }

    const timeout = setTimeout(() => codeInputRef.current?.focus(), 100);
    return () => clearTimeout(timeout);
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
      return;
    }

    cooldownRef.current = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
            cooldownRef.current = null;
          }
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, [cooldown]);

  const handleSendCode = useCallback(async () => {
    setErrorMessage(null);
    setIsSending(true);

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ purpose }),
      });
      const payload = (await response.json().catch(() => null)) as {
        cooldownSeconds?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to send verification code.');
      }

      const cooldownSeconds = payload?.cooldownSeconds ?? 60;
      setStep('code-sent');
      setCooldown(cooldownSeconds);

      pushToast({
        tone: 'success',
        title: 'Code sent',
        description: `A 6-digit code has been sent to ${currentEmail}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send code.';
      setErrorMessage(message);
      pushToast({ tone: 'danger', title: 'Failed', description: message });
    } finally {
      setIsSending(false);
    }
  }, [currentEmail, purpose, pushToast]);

  const handleVerifyCode = useCallback(async () => {
    if (code.length !== 6) {
      return;
    }

    setErrorMessage(null);
    setIsVerifying(true);

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, purpose, next: nextPath }),
      });
      const payload = (await response.json().catch(() => null)) as {
        verified?: boolean;
        redirectTo?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.verified) {
        throw new Error(payload?.error ?? 'Verification failed.');
      }

      pushToast({
        tone: 'success',
        title: 'Verified',
        description:
          purpose === 'email_change_current'
            ? 'Current email verified. We sent a confirmation button to your new email.'
            : 'Two-step verification complete.',
      });

      window.location.assign(payload.redirectTo ?? nextPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed.';
      setErrorMessage(message);
      pushToast({ tone: 'danger', title: 'Failed', description: message });
    } finally {
      setIsVerifying(false);
    }
  }, [code, nextPath, purpose, pushToast]);

  const title = purpose === 'email_change_current' ? 'Confirm Email Change' : 'Two-Step Verification';
  const intro =
    purpose === 'email_change_current'
      ? 'Before we change your sign-in email, enter the 6-digit code sent to your current inbox.'
      : 'Your account requires an extra verification step before sign-in is complete.';
  const destinationLabel =
    purpose === 'email_change_current' ? 'Current email verification destination' : 'Verification code destination';
  const destinationHelp =
    step === 'initial'
      ? 'Click the button below to receive a 6-digit code at this email.'
      : purpose === 'email_change_current'
        ? 'Enter the 6-digit code we sent to your current email before we continue the email change.'
        : 'Enter the 6-digit code we sent to this email.';
  const verifyButtonLabel =
    purpose === 'email_change_current' ? 'Verify and Continue Email Change' : 'Verify and Continue';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-8 shadow-2xl shadow-black/30">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{intro}</p>
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
              <ShieldCheck className="h-5 w-5 text-teal-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{destinationLabel}</p>
              <p className="mt-1 text-sm text-neutral-400">{currentEmail}</p>
              <p className="mt-2 text-sm text-neutral-500">{destinationHelp}</p>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : null}

        {step === 'initial' ? (
          <Button type="button" className="h-12 w-full" onClick={handleSendCode} disabled={isSending}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {isSending ? 'Sending code...' : 'Send Verification Code'}
          </Button>
        ) : (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                Verification Code
              </label>
              <Input
                ref={codeInputRef}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="h-14 rounded-xl border-white/10 bg-white/[0.04] text-center font-mono text-2xl tracking-[0.4em] text-white placeholder:text-neutral-700 focus:border-teal-500/50 focus:ring-teal-500/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && code.length === 6) {
                    void handleVerifyCode();
                  }
                }}
              />
              <p className="mt-2 text-xs text-neutral-500">
                Code expires in 5 minutes. {cooldown > 0 ? `Resend available in ${cooldown}s.` : ''}
              </p>
              <p className="mt-2 text-xs text-neutral-600">
                If the code is not visible right away, check Primary, Promotions, and Spam, or search
                for “Study Assistant sign-in code”.
              </p>
            </div>

            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={isVerifying || code.length < 6}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition-all hover:bg-neutral-200 disabled:opacity-50"
            >
              {isVerifying ? 'Verifying...' : verifyButtonLabel}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isSending || cooldown > 0}
                className="text-sm font-medium text-teal-400 transition-colors hover:text-teal-300 disabled:cursor-not-allowed disabled:text-neutral-600"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-3 text-sm">
          <Link href={backPath} className="text-neutral-500 transition-colors hover:text-white">
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
