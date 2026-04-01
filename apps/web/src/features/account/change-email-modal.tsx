'use client';

import { useState } from 'react';
import type { Route } from 'next';
import { X, Loader2, Mail, Check, ArrowRight } from 'lucide-react';

import { Button, Input } from '@study-assistant/ui';
import { useToast } from '@/components/providers/toast-provider';

type Step = 1 | 2 | 3;

type ChangeEmailModalProps = {
  open: boolean;
  onClose: () => void;
  currentEmail: string;
  accountPath: Route;
};

export function ChangeEmailModal({ open, onClose, currentEmail, accountPath }: ChangeEmailModalProps) {
  const { pushToast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [newEmail, setNewEmail] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setStep(1);
    setNewEmail('');
    setError(null);
    onClose();
  }

  // Step 1: Request OTP to current email (triggers Supabase email change)
  // Step 2: Enter new email
  // Step 3: Confirmation sent

  async function handleRequestChange() {
    if (!newEmail.trim()) {
      setError('Please enter your new email address.');
      return;
    }

    if (newEmail.trim().toLowerCase() === currentEmail.trim().toLowerCase()) {
      setError('New email must be different from your current email.');
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const res = await fetch('/api/account/email-change/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: newEmail.trim(),
          next: accountPath,
        }),
      });

      const data = (await res.json().catch(() => null)) as { redirectTo?: string; error?: string } | null;

      if (!res.ok || !data?.redirectTo) {
        throw new Error(data?.error ?? 'Unable to start email change.');
      }

      pushToast({
        tone: 'success',
        title: 'Verification sent',
        description: 'Check both your current and new email for verification links.',
      });

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request email change.');
    } finally {
      setIsWorking(false);
    }
  }

  if (!open) return null;

  const steps = [
    { num: 1, label: 'Verify current email' },
    { num: 2, label: 'Enter new email' },
    { num: 3, label: 'Confirm change' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/60 bg-background p-0 shadow-soft-xl animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Mail className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Change Email Address</h2>
              <p className="text-xs text-muted-foreground">Update your sign-in email</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Step Indicators */}
          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.num} className="flex items-center gap-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  s.num < step
                    ? 'bg-success text-success-foreground'
                    : s.num === step
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-surface text-muted-foreground'
                }`}>
                  {s.num < step ? <Check className="h-3.5 w-3.5" /> : s.num}
                </div>
                <span className={`text-sm ${
                  s.num < step
                    ? 'text-muted-foreground line-through'
                    : s.num === step
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground'
                }`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Step 1: Show current email */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/40 bg-surface/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Current email</p>
                <p className="text-sm font-medium text-foreground">{currentEmail}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll send a verification to your current email as part of the change process.
              </p>
              <Button onClick={() => setStep(2)} className="w-full h-11">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Enter new email */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">New email address</label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new-email@example.com"
                  className="h-11"
                  disabled={isWorking}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1 h-11" disabled={isWorking}>
                  Back
                </Button>
                <Button onClick={handleRequestChange} className="flex-1 h-11" disabled={isWorking || !newEmail.trim()}>
                  {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-success/30 bg-success/10 p-4">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Verification emails sent</p>
                    <p className="text-xs text-muted-foreground">
                      Check your current email (<span className="font-medium text-foreground">{currentEmail}</span>) and your new email (<span className="font-medium text-foreground">{newEmail}</span>) for verification links. Click both links to complete the change.
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="secondary" onClick={handleClose} className="w-full h-11">
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
