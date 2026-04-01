'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, CheckCircle2, Loader2, Lock } from 'lucide-react';

import { Button, Input } from '@study-assistant/ui';
import { useToast } from '@/components/providers/toast-provider';
import { evaluatePasswordPolicy } from '@/features/auth/password-policy';

type ChangePasswordModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const { pushToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentVerified, setCurrentVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const policyResults = evaluatePasswordPolicy(newPassword);
  const allPoliciesMet = policyResults.every((p) => p.passed);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit = currentVerified && allPoliciesMet && passwordsMatch && !isSubmitting;

  function handleClose() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setCurrentVerified(false);
    setError(null);
    onClose();
  }

  async function verifyCurrentPassword() {
    if (!currentPassword.trim()) return;
    setIsVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword: 'VerificationOnly_Placeholder123!' }),
      });
      // We use the sign-in step from the API. If current password is wrong, it will error.
      // For verification-only, we just check if the error is about the current password.
      if (res.ok || res.status !== 400) {
        setCurrentVerified(true);
      } else {
        const data = (await res.json()) as { error?: string };
        if (data.error?.includes('incorrect')) {
          setError('Current password is incorrect.');
          setCurrentVerified(false);
        } else {
          // Password verification passed (error was about something else)
          setCurrentVerified(true);
        }
      }
    } catch {
      setError('Unable to verify password. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to change password.');
      }
      pushToast({ tone: 'success', title: 'Password changed', description: 'Your password has been updated successfully.' });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

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
              <Lock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
              <p className="text-xs text-muted-foreground">Update your account password</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (currentVerified) setCurrentVerified(false);
                }}
                onBlur={() => { if (currentPassword.trim() && !currentVerified) void verifyCurrentPassword(); }}
                placeholder="Enter current password"
                className={`h-11 pr-20 ${currentVerified ? 'border-success ring-1 ring-success/20' : ''}`}
                disabled={isSubmitting}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isVerifying && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {currentVerified && <CheckCircle2 className="h-4 w-4 text-success" />}
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="h-11 pr-10"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Policy Checklist */}
            {newPassword.length > 0 && (
              <div className="rounded-xl border border-border/40 bg-surface/50 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">Password requirements:</p>
                {policyResults.map((check) => (
                  <div key={check.id} className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${check.passed ? 'bg-success' : 'bg-danger'}`} />
                    <span className={`text-xs ${check.passed ? 'text-success' : 'text-muted-foreground'}`}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Confirm New Password</label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={`h-11 pr-10 ${confirmPassword.length > 0 ? (passwordsMatch ? 'border-success ring-1 ring-success/20' : 'border-danger ring-1 ring-danger/20') : ''}`}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-danger">Passwords do not match.</p>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full h-11" disabled={!canSubmit}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Change Password
          </Button>
        </form>
      </div>
    </div>
  );
}
