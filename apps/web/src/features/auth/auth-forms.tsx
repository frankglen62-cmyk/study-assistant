'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/providers/toast-provider';
import { CaptchaWidget } from '@/features/auth/captcha-widget';
import { evaluatePasswordPolicy, strongPasswordSchema } from '@/features/auth/password-policy';
import { env } from '@/lib/env/client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Input } from '@study-assistant/ui';

/* ═══════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════ */

function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`h-12 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-neutral-600 focus:border-teal-500/50 focus:ring-teal-500/20 ${className ?? ''}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors hover:text-white"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const styledInput = 'h-12 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-neutral-600 focus:border-teal-500/50 focus:ring-teal-500/20';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const registerSchema = loginSchema
  .extend({
    fullName: z.string().min(2, 'Enter your full name.'),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

const resetSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

function AuthCardShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-8 shadow-2xl shadow-black/30">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function getSafeNextPath(candidate: string | null, fallback: string) {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }
  return candidate;
}

function getReadableAuthError(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }
  const message = error.message.toLowerCase();
  if (message.includes('invalid login credentials')) {
    return 'The email or password is incorrect.';
  }
  if (message.includes('email not confirmed')) {
    return 'Verify your email address first, then sign in again.';
  }
  if (message.includes('weak_password') || message.includes('weak password')) {
    return 'Use at least 12 characters with uppercase, lowercase, number, and symbol.';
  }
  if (message.includes('leaked') || message.includes('compromised') || message.includes('breached')) {
    return 'This password appears in known breach datasets. Choose a different password.';
  }
  if (message.includes('captcha')) {
    return 'Complete the security check and try again.';
  }
  if (message.includes('same password')) {
    return 'Choose a different password than your current one.';
  }
  if (message.includes('mfa_totp_enroll_not_enabled') || message.includes('mfa_totp_verify_not_enabled')) {
    return 'Authenticator MFA is still disabled in Supabase. Enable TOTP first.';
  }
  return error.message;
}

function AuthNotice({ tone, message }: { tone: 'info' | 'success' | 'danger'; message: string }) {
  const className =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : tone === 'danger'
        ? 'border-red-500/30 bg-red-500/10 text-red-300'
        : 'border-white/10 bg-white/[0.04] text-neutral-400';

  return <div className={`rounded-xl border px-4 py-3 text-sm ${className}`}>{message}</div>;
}

/* ═══════════════════════════════════════════
   Social Auth Buttons
   ═══════════════════════════════════════════ */

function buildMfaPath(nextPath: string) {
  return `/mfa?next=${encodeURIComponent(nextPath)}`;
}

function useCaptchaState() {
  const captchaEnabled = Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const handleCaptchaChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
    if (token) {
      setCaptchaError(null);
    }
  }, []);

  const ensureCaptcha = useCallback(() => {
    if (!captchaEnabled) {
      return true;
    }

    if (captchaToken) {
      return true;
    }

    setCaptchaError('Complete the security check first.');
    return false;
  }, [captchaEnabled, captchaToken]);

  const resetCaptcha = useCallback(() => {
    if (!captchaEnabled) {
      return;
    }

    setCaptchaToken(null);
    setCaptchaResetKey((value) => value + 1);
  }, [captchaEnabled]);

  return {
    captchaEnabled,
    captchaError,
    captchaResetKey,
    captchaToken,
    ensureCaptcha,
    handleCaptchaChange,
    resetCaptcha,
  };
}

function PasswordRequirements({ password }: { password: string }) {
  const checks = evaluatePasswordPolicy(password);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Password requirements</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <div key={check.id} className={`flex items-center gap-2 text-xs ${check.passed ? 'text-emerald-300' : 'text-neutral-500'}`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${check.passed ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
              {check.passed ? <Check className="h-3 w-3" /> : null}
            </span>
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialAuthButtons({
  label = 'Sign in',
  nextPath = '/dashboard',
  captchaRequired = false,
  captchaToken,
  onCaptchaRequired,
}: {
  label?: string;
  nextPath?: string;
  captchaRequired?: boolean;
  captchaToken?: string | null;
  onCaptchaRequired?: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    if (captchaRequired && !captchaToken) {
      onCaptchaRequired?.();
      return;
    }

    setLoading(provider);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(buildMfaPath(nextPath))}`,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => handleSocialLogin('google')}
        disabled={loading !== null}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-white transition-all hover:bg-white/[0.08] disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {loading === 'google' ? 'Connecting...' : `${label} with Google`}
      </button>

      <button
        type="button"
        onClick={() => handleSocialLogin('facebook')}
        disabled={loading !== null}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-white transition-all hover:bg-white/[0.08] disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        {loading === 'facebook' ? 'Connecting...' : `${label} with Facebook`}
      </button>
    </div>
  );
}

function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/[0.06]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[#111111] px-4 text-sm text-neutral-600">OR</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LOGIN FORM
   ═══════════════════════════════════════════ */

export function LoginForm() {
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const [formError, setFormError] = useState<string | null>(searchParams.get('error'));
  const { captchaError, captchaResetKey, captchaToken, ensureCaptcha, handleCaptchaChange, resetCaptcha } = useCaptchaState();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const nextPath = useMemo(() => getSafeNextPath(searchParams.get('next'), '/dashboard'), [searchParams]);

  return (
    <AuthCardShell title="Sign In" description="Welcome back! Please enter your details.">
      {/* Social buttons */}
      <SocialAuthButtons
        label="Sign in"
        nextPath={nextPath}
        captchaRequired={Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)}
        captchaToken={captchaToken}
        onCaptchaRequired={() => {
          setFormError(null);
          ensureCaptcha();
        }}
      />
      <AuthDivider />

      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          if (!ensureCaptcha()) {
            return;
          }
          try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.signInWithPassword({
              email: values.email,
              password: values.password,
              options: captchaToken ? { captchaToken } : undefined,
            });
            if (error) throw error;
            window.location.assign(buildMfaPath(nextPath));
            return;
          } catch (error) {
            const message = getReadableAuthError(error, 'Unable to sign in.');
            setFormError(message);
            resetCaptcha();
            pushToast({ tone: 'danger', title: 'Login failed', description: message });
          }
        })}
      >
        {searchParams.get('registered') === 'true' ? (
          <AuthNotice tone="success" message="Registration successful! Please check your email and click the verification link before signing in." />
        ) : null}
        {formError ? <AuthNotice tone="danger" message={formError} /> : null}

        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} placeholder="name@school.edu" className={styledInput} />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <PasswordInput {...register('password')} placeholder="Enter your password" />
        </FormField>

        <CaptchaWidget action="login" resetKey={captchaResetKey} error={captchaError} onTokenChange={handleCaptchaChange} />

        <div className="flex items-center justify-between gap-3 text-sm">
          <Link href="/forgot-password" className="text-teal-400 hover:text-teal-300">
            Forgot password?
          </Link>
          <Link href="/register" className="text-neutral-500 hover:text-white">
            Create account
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition-all hover:bg-neutral-200 disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-600">
        Don't have an account?{' '}
        <Link href="/register" className="font-medium text-teal-400 hover:text-teal-300">
          Sign up
        </Link>
      </p>
    </AuthCardShell>
  );
}

/* ═══════════════════════════════════════════
   REGISTER FORM
   ═══════════════════════════════════════════ */

export function RegisterForm() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { captchaError, captchaResetKey, captchaToken, ensureCaptcha, handleCaptchaChange, resetCaptcha } = useCaptchaState();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });
  const passwordValue = watch('password', '');

  return (
    <AuthCardShell title="Create Account" description="Set up a client account and start studying.">
      <SocialAuthButtons
        label="Sign up"
        nextPath="/dashboard"
        captchaRequired={Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)}
        captchaToken={captchaToken}
        onCaptchaRequired={() => {
          setFormError(null);
          ensureCaptcha();
        }}
      />
      <AuthDivider />

      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          setSuccessMessage(null);
          if (!ensureCaptcha()) {
            return;
          }
          try {
            const supabase = getSupabaseBrowserClient();
            const { data, error } = await supabase.auth.signUp({
              email: values.email,
              password: values.password,
              options: {
                data: { full_name: values.fullName },
                emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(buildMfaPath('/dashboard'))}`,
                ...(captchaToken ? { captchaToken } : {}),
              },
            });
            if (error) throw error;
            if (data.session) {
              window.location.assign(buildMfaPath('/dashboard'));
              router.refresh();
              return;
            }
            const message = 'Account created! We sent a verification link to your email.';
            setSuccessMessage(message);
            pushToast({ tone: 'success', title: 'Registration complete', description: 'Check your email to verify.' });
            setTimeout(() => router.replace('/login?registered=true'), 3000);
          } catch (error) {
            const message = getReadableAuthError(error, 'Unable to create your account.');
            setFormError(message);
            resetCaptcha();
            pushToast({ tone: 'danger', title: 'Registration failed', description: message });
          }
        })}
      >
        {successMessage ? <AuthNotice tone="success" message={successMessage} /> : null}
        {formError ? <AuthNotice tone="danger" message={formError} /> : null}

        <FormField label="Full name" error={errors.fullName?.message}>
          <Input {...register('fullName')} placeholder="Jordan Reyes" className={styledInput} />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} placeholder="jordan@example.com" className={styledInput} />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <PasswordInput {...register('password')} placeholder="Create a password" />
        </FormField>
        <FormField label="Confirm password" error={errors.confirmPassword?.message}>
          <PasswordInput {...register('confirmPassword')} placeholder="Repeat your password" />
        </FormField>
        <PasswordRequirements password={passwordValue} />
        <CaptchaWidget action="register" resetKey={captchaResetKey} error={captchaError} onTokenChange={handleCaptchaChange} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition-all hover:bg-neutral-200 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account...' : 'Register'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-teal-400 hover:text-teal-300">
          Sign in
        </Link>
      </p>
    </AuthCardShell>
  );
}

/* ═══════════════════════════════════════════
   FORGOT PASSWORD
   ═══════════════════════════════════════════ */

export function ForgotPasswordForm() {
  const { pushToast } = useToast();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { captchaError, captchaResetKey, captchaToken, ensureCaptcha, handleCaptchaChange, resetCaptcha } = useCaptchaState();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
  });

  return (
    <AuthCardShell title="Reset Password" description="We'll send a secure reset link to your email.">
      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          setSuccessMessage(null);
          if (!ensureCaptcha()) {
            return;
          }
          try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
              redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
              ...(captchaToken ? { captchaToken } : {}),
            });
            if (error) throw error;
            const message = 'If the account exists, a reset link has been sent.';
            setSuccessMessage(message);
            pushToast({ tone: 'success', title: 'Reset email sent', description: message });
          } catch (error) {
            const message = getReadableAuthError(error, 'Unable to send the reset email.');
            setFormError(message);
            resetCaptcha();
            pushToast({ tone: 'danger', title: 'Reset failed', description: message });
          }
        })}
      >
        {successMessage ? <AuthNotice tone="success" message={successMessage} /> : null}
        {formError ? <AuthNotice tone="danger" message={formError} /> : null}

        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} placeholder="name@school.edu" className={styledInput} />
        </FormField>

        <CaptchaWidget action="forgot-password" resetKey={captchaResetKey} error={captchaError} onTokenChange={handleCaptchaChange} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition-all hover:bg-neutral-200 disabled:opacity-50"
        >
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-600">
        <Link href="/login" className="font-medium text-teal-400 hover:text-teal-300">
          Back to sign in
        </Link>
      </p>
    </AuthCardShell>
  );
}

/* ═══════════════════════════════════════════
   RESET PASSWORD
   ═══════════════════════════════════════════ */

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(searchParams.get('error'));
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
  });
  const passwordValue = watch('password', '');

  return (
    <AuthCardShell title="New Password" description="Use a strong password you do not reuse elsewhere.">
      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          setSuccessMessage(null);
          try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.updateUser({ password: values.password });
            if (error) throw error;
            const message = 'Password updated. Redirecting to your dashboard...';
            setSuccessMessage(message);
            pushToast({ tone: 'success', title: 'Password updated', description: message });
            window.location.assign(buildMfaPath('/dashboard'));
            router.refresh();
          } catch (error) {
            const message = getReadableAuthError(error, 'Unable to update the password.');
            setFormError(message);
            pushToast({ tone: 'danger', title: 'Password update failed', description: message });
          }
        })}
      >
        {successMessage ? <AuthNotice tone="success" message={successMessage} /> : null}
        {formError ? <AuthNotice tone="danger" message={formError} /> : null}

        <FormField label="New password" error={errors.password?.message}>
          <PasswordInput {...register('password')} placeholder="New password" />
        </FormField>
        <FormField label="Confirm password" error={errors.confirmPassword?.message}>
          <PasswordInput {...register('confirmPassword')} placeholder="Confirm new password" />
        </FormField>
        <PasswordRequirements password={passwordValue} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition-all hover:bg-neutral-200 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Password'}
        </button>
      </form>
    </AuthCardShell>
  );
}
