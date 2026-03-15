'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/providers/toast-provider';
import { env } from '@/lib/env/client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@study-assistant/ui';

function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={className} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

const registerSchema = loginSchema
  .extend({
    fullName: z.string().min(2, 'Enter your full name.'),
    confirmPassword: z.string().min(8, 'Confirm your password.'),
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
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(8, 'Confirm your password.'),
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
    <Card className="rounded-[32px] p-0">
      <CardHeader className="p-8 pb-0">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-8">{children}</CardContent>
    </Card>
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

  if (message.includes('same password')) {
    return 'Choose a different password than your current one.';
  }

  return error.message;
}

function AuthNotice({ tone, message }: { tone: 'info' | 'success' | 'danger'; message: string }) {
  const className =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-foreground'
      : tone === 'danger'
        ? 'border-danger/40 bg-danger/10 text-foreground'
        : 'border-border/70 bg-background/60 text-muted-foreground';

  return <div className={`rounded-[22px] border px-4 py-3 text-sm ${className}`}>{message}</div>;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const [formError, setFormError] = useState<string | null>(searchParams.get('error'));
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const nextPath = useMemo(() => getSafeNextPath(searchParams.get('next'), '/dashboard'), [searchParams]);

  return (
    <AuthCardShell title="Welcome back" description="Sign in to your portal or admin workspace.">
      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);

          try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.signInWithPassword({
              email: values.email,
              password: values.password,
            });

            if (error) {
              throw error;
            }

            window.location.assign(nextPath);
            return;
          } catch (error) {
            const message = getReadableAuthError(error, 'Unable to sign in.');
            setFormError(message);
            pushToast({
              tone: 'danger',
              title: 'Login failed',
              description: message,
            });
          }
        })}
      >
        {searchParams.get('registered') === 'true' ? (
          <AuthNotice tone="success" message="Registration successful! Please check your email and click the verification link before signing in." />
        ) : null}
        {formError ? <AuthNotice tone="danger" message={formError} /> : null}
        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} placeholder="name@school.edu" />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <PasswordInput {...register('password')} placeholder="Enter your password" />
        </FormField>
        <div className="flex items-center justify-between gap-3 text-sm">
          <Link href="/forgot-password" className="text-accent hover:text-accent/80">
            Forgot password?
          </Link>
          <Link href="/register" className="text-muted-foreground hover:text-foreground">
            Create account
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Login'}
        </Button>
      </form>
    </AuthCardShell>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });

  return (
    <AuthCardShell
      title="Create your account"
      description="Set up a client account now and pair the extension after login."
    >
      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          setSuccessMessage(null);

          try {
            const supabase = getSupabaseBrowserClient();
            const { data, error } = await supabase.auth.signUp({
              email: values.email,
              password: values.password,
              options: {
                data: {
                  full_name: values.fullName,
                },
                emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
              },
            });

            if (error) {
              throw error;
            }

            if (data.session) {
              router.replace('/dashboard');
              router.refresh();
              return;
            }

            const message = 'Account created successfully! We sent a verification link to your email. Please check your inbox (and spam folder) to verify your address, then you can sign in.';
            setSuccessMessage(message);
            pushToast({
              tone: 'success',
              title: 'Registration complete',
              description: 'Check your email to verify your address.',
            });

            // Redirect to login page after a short delay
            setTimeout(() => {
              router.replace('/login?registered=true');
            }, 3000);
          } catch (error) {
            const message = getReadableAuthError(error, 'Unable to create your account.');
            setFormError(message);
            pushToast({
              tone: 'danger',
              title: 'Registration failed',
              description: message,
            });
          }
        })}
      >
        {successMessage ? <AuthNotice tone="success" message={successMessage} /> : null}
        {formError ? <AuthNotice tone="danger" message={formError} /> : null}
        <FormField label="Full name" error={errors.fullName?.message}>
          <Input {...register('fullName')} placeholder="Jordan Reyes" />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} placeholder="jordan@example.com" />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <PasswordInput {...register('password')} placeholder="Create a password" />
        </FormField>
        <FormField label="Confirm password" error={errors.confirmPassword?.message}>
          <PasswordInput {...register('confirmPassword')} placeholder="Repeat your password" />
        </FormField>
        <div className="flex items-center justify-end text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Already have an account? Sign in
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Register'}
        </Button>
      </form>
    </AuthCardShell>
  );
}

export function ForgotPasswordForm() {
  const { pushToast } = useToast();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
  });

  return (
    <AuthCardShell title="Reset your password" description="We'll send a secure reset link to the email address on file.">
      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          setSuccessMessage(null);

          try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
              redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
            });

            if (error) {
              throw error;
            }

            const message = 'If the account exists, a reset link has been sent.';
            setSuccessMessage(message);
            pushToast({
              tone: 'success',
              title: 'Reset email sent',
              description: message,
            });
          } catch (error) {
            const message = getReadableAuthError(error, 'Unable to send the password reset email.');
            setFormError(message);
            pushToast({
              tone: 'danger',
              title: 'Reset failed',
              description: message,
            });
          }
        })}
      >
        {successMessage ? <AuthNotice tone="success" message={successMessage} /> : null}
        {formError ? <AuthNotice tone="danger" message={formError} /> : null}
        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} placeholder="name@school.edu" />
        </FormField>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </form>
    </AuthCardShell>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(searchParams.get('error'));
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
  });

  return (
    <AuthCardShell title="Choose a new password" description="Use a strong password you do not reuse elsewhere.">
      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          setSuccessMessage(null);

          try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.updateUser({
              password: values.password,
            });

            if (error) {
              throw error;
            }

            const message = 'Password updated. You can now continue in the portal.';
            setSuccessMessage(message);
            pushToast({
              tone: 'success',
              title: 'Password updated',
              description: message,
            });

            router.replace('/dashboard');
            router.refresh();
          } catch (error) {
            const message = getReadableAuthError(error, 'Unable to update the password.');
            setFormError(message);
            pushToast({
              tone: 'danger',
              title: 'Password update failed',
              description: message,
            });
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
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Password'}
        </Button>
      </form>
    </AuthCardShell>
  );
}
