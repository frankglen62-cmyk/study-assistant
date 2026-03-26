'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';

import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/providers/toast-provider';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@study-assistant/ui';

function getSafeNextPath(candidate: string | null, fallback = '/dashboard') {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  return candidate;
}

function formatMfaError(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const message = error.message.toLowerCase();
  if (message.includes('mfa_totp_enroll_not_enabled') || message.includes('mfa_totp_verify_not_enabled')) {
    return 'TOTP MFA is still disabled in Supabase. Enable TOTP in Authentication > Multi-Factor Auth.';
  }
  if (message.includes('mfa_verification_failed') || message.includes('verification failed')) {
    return 'The authenticator code is invalid or already expired. Try the latest 6-digit code.';
  }
  if (message.includes('insufficient_aal')) {
    return 'This action needs a fully verified MFA session. Sign in again and complete MFA first.';
  }

  return error.message;
}

type VerifiedTotpFactor = {
  id: string;
  friendly_name?: string;
  status?: string;
};

type PendingEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const nextPath = useMemo(() => getSafeNextPath(searchParams.get('next'), '/dashboard'), [searchParams]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const supabase = getSupabaseBrowserClient();
      const [{ data: userData }, { data: aalData, error: aalError }, { data: factorData, error: factorError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

      if (cancelled) {
        return;
      }

      if (!userData.user) {
        window.location.assign('/login');
        return;
      }

      if (aalError) {
        setFormError(formatMfaError(aalError, 'Unable to read MFA status.'));
        setIsLoading(false);
        return;
      }

      if (factorError) {
        setFormError(formatMfaError(factorError, 'Unable to load your MFA factors.'));
        setIsLoading(false);
        return;
      }

      if (aalData.currentLevel === 'aal2' || aalData.nextLevel !== 'aal2') {
        window.location.assign(nextPath);
        return;
      }

      const verifiedFactor = factorData.totp.find((factor) => factor.status === 'verified');
      if (!verifiedFactor) {
        setFormError('No verified authenticator app is enrolled for this account.');
        setIsLoading(false);
        return;
      }

      setFactorId(verifiedFactor.id);
      setStatusMessage(`Enter the 6-digit code from ${verifiedFactor.friendly_name ?? 'your authenticator app'}.`);
      setIsLoading(false);
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [nextPath]);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-8 shadow-2xl shadow-black/30">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{isLoading ? 'Finishing Sign In' : 'Confirm Authenticator'}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {isLoading
            ? 'Checking your account security settings before redirecting you.'
            : 'Your account uses two-step verification. Enter the current code to continue.'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-400">
            Checking whether this account needs an authenticator challenge...
          </div>

          <button
            type="button"
            disabled
            className="flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black opacity-60"
          >
            Checking MFA status...
          </button>

          <p className="text-center text-sm text-neutral-600">
            Lost access?{' '}
            <Link href="/login" className="font-medium text-teal-400 hover:text-teal-300">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!factorId) {
            return;
          }
          setFormError(null);
          setIsVerifying(true);
          try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.mfa.challengeAndVerify({
              factorId,
              code: code.trim(),
            });
            if (error) {
              throw error;
            }

            pushToast({ tone: 'success', title: 'Authenticator verified', description: 'You can continue to your dashboard now.' });
            window.location.assign(nextPath);
          } catch (error) {
            const message = formatMfaError(error, 'Unable to verify the authenticator code.');
            setFormError(message);
            pushToast({ tone: 'danger', title: 'Verification failed', description: message });
          } finally {
            setIsVerifying(false);
          }
        }}
      >
        {statusMessage ? <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-400">{statusMessage}</div> : null}
        {formError ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{formError}</div> : null}

        <FormField label="Authenticator code" description="Use the current 6-digit code from your app.">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            className="h-12 rounded-xl border-white/10 bg-white/[0.04] font-mono text-lg tracking-[0.35em] text-white placeholder:text-neutral-600 focus:border-teal-500/50 focus:ring-teal-500/20"
          />
        </FormField>

        <button
          type="submit"
          disabled={isVerifying || code.trim().length < 6}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition-all hover:bg-neutral-200 disabled:opacity-50"
        >
          {isVerifying ? 'Verifying...' : 'Verify and Continue'}
        </button>

        <p className="text-center text-sm text-neutral-600">
          Lost access?{' '}
          <Link href="/login" className="font-medium text-teal-400 hover:text-teal-300">
            Back to sign in
          </Link>
        </p>
      </form>
      )}
    </div>
  );
}

export function MfaSecurityCard() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedFactors, setVerifiedFactors] = useState<VerifiedTotpFactor[]>([]);
  const [aalLabel, setAalLabel] = useState<'aal1' | 'aal2' | 'unknown'>('unknown');
  const [pendingEnrollment, setPendingEnrollment] = useState<PendingEnrollment | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const activeFactor = verifiedFactors[0] ?? null;

  const loadState = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const [{ data: factorData, error: factorError }, { data: aalData, error: aalError }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      if (factorError) {
        throw factorError;
      }

      if (aalError) {
        throw aalError;
      }

      setVerifiedFactors(
        factorData.totp
          .filter((factor) => factor.status === 'verified')
          .map((factor) => ({ id: factor.id, friendly_name: factor.friendly_name, status: factor.status })),
      );
      setAalLabel(aalData.currentLevel ?? 'unknown');
    } catch (error) {
      setErrorMessage(formatMfaError(error, 'Unable to load authenticator settings.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

  const handleEnroll = async () => {
    setErrorMessage(null);
    setIsWorking(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Study Assistant Authenticator',
      });
      if (error) {
        throw error;
      }

      setPendingEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setVerifyCode('');
      pushToast({ tone: 'success', title: 'Authenticator ready', description: 'Scan the QR code, then enter the first 6-digit code to finish setup.' });
    } catch (error) {
      const message = formatMfaError(error, 'Unable to start authenticator setup.');
      setErrorMessage(message);
      pushToast({ tone: 'danger', title: 'Setup failed', description: message });
    } finally {
      setIsWorking(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!pendingEnrollment) {
      return;
    }

    setErrorMessage(null);
    setIsWorking(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingEnrollment.factorId,
        code: verifyCode.trim(),
      });
      if (error) {
        throw error;
      }

      setPendingEnrollment(null);
      setVerifyCode('');
      await loadState();
      router.refresh();
      pushToast({ tone: 'success', title: 'Authenticator enabled', description: 'Two-step verification is now active for future sign-ins.' });
    } catch (error) {
      const message = formatMfaError(error, 'Unable to verify the authenticator code.');
      setErrorMessage(message);
      pushToast({ tone: 'danger', title: 'Verification failed', description: message });
    } finally {
      setIsWorking(false);
    }
  };

  const handleUnenroll = async () => {
    const factor = verifiedFactors[0];
    if (!factor) {
      return;
    }

    setErrorMessage(null);
    setIsWorking(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) {
        throw error;
      }

      await loadState();
      router.refresh();
      pushToast({ tone: 'success', title: 'Authenticator removed', description: 'Optional MFA has been turned off for this account.' });
    } catch (error) {
      const message = formatMfaError(error, 'Unable to remove the authenticator app.');
      setErrorMessage(message);
      pushToast({ tone: 'danger', title: 'Removal failed', description: message });
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Authenticator App</CardTitle>
        <CardDescription>Optional MFA using a TOTP app like Google Authenticator, 1Password, or Authy.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Status</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{verifiedFactors.length > 0 ? 'Enabled' : 'Not enabled'}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {verifiedFactors.length > 0 ? 'An authenticator app will be required on future sign-ins.' : 'Add a second layer of protection to this account.'}
            </p>
          </div>
          <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Current session AAL</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{aalLabel === 'unknown' ? 'Checking…' : aalLabel.toUpperCase()}</p>
            <p className="mt-2 text-sm text-muted-foreground">`AAL2` means this session already passed password/social login plus MFA.</p>
          </div>
        </div>

        {errorMessage ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{errorMessage}</div> : null}

        {pendingEnrollment ? (
          <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Finish authenticator setup
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Scan the QR code, then enter the first code from your authenticator app.</p>

            <div className="mt-4 grid gap-4 lg:grid-cols-[180px_1fr]">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-white p-3">
                <img src={pendingEnrollment.qrCode} alt="Authenticator QR code" className="h-full w-full" />
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Manual setup secret</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <code className="break-all text-sm text-foreground">{pendingEnrollment.secret}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 rounded-full p-0"
                      onClick={async () => {
                        await navigator.clipboard.writeText(pendingEnrollment.secret);
                        pushToast({ tone: 'success', title: 'Copied', description: 'Authenticator secret copied to clipboard.' });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <FormField label="Verification code" description="Enter the 6-digit code from the app you just connected.">
                  <Input
                    value={verifyCode}
                    onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    placeholder="123456"
                    className="h-12 rounded-xl border-white/10 bg-white/[0.04] font-mono text-lg tracking-[0.35em] text-white placeholder:text-neutral-600 focus:border-teal-500/50 focus:ring-teal-500/20"
                  />
                </FormField>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={handleVerifyEnrollment} disabled={isWorking || verifyCode.trim().length < 6}>
                    {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Verify and enable
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setPendingEnrollment(null);
                      setVerifyCode('');
                    }}
                    disabled={isWorking}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : activeFactor ? (
          <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{activeFactor.friendly_name ?? 'Authenticator app'}</p>
                <p className="mt-1 text-sm text-muted-foreground">Active TOTP factor. Your next sign-in will ask for a 6-digit code.</p>
              </div>
              <Button type="button" variant="danger" onClick={handleUnenroll} disabled={isLoading || isWorking}>
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-[22px] border border-dashed border-border/70 bg-background/40 px-5 py-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                <Smartphone className="h-5 w-5 text-accent" />
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Add an authenticator app</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Optional but recommended. This protects your account even if your password gets reused elsewhere.
                  </p>
                </div>
                <Button type="button" onClick={handleEnroll} disabled={isLoading || isWorking}>
                  {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Set up authenticator
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
