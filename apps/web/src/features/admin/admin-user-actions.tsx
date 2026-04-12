'use client';

import { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Eye,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShieldOff,
  Square,
  X,
} from 'lucide-react';

import { Button, Input, Textarea } from '@study-assistant/ui';

import { useToast } from '@/components/providers/toast-provider';

interface AdminUserActionsProps {
  userId: string;
  accountStatus: 'active' | 'suspended' | 'pending_verification' | 'banned';
  hasActiveSession?: boolean;
  onCompleted?: () => void;
}

interface ConfirmModalState {
  action: 'suspend' | 'reactivate' | 'ban' | 'restore' | 'force_end';
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  requiresReason?: boolean;
  reasonPlaceholder?: string;
  supportsSuspendedUntil?: boolean;
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T & { error?: string };
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/60 bg-background shadow-2xl ring-1 ring-white/5">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const CREDIT_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '2 hr', minutes: 120 },
  { label: '5 hr', minutes: 300 },
];

export function AdminUserActions({ userId, accountStatus, hasActiveSession, onCompleted }: AdminUserActionsProps) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [deductModal, setDeductModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [creditMinutes, setCreditMinutes] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [confirmReason, setConfirmReason] = useState('');
  const [confirmSuspendedUntil, setConfirmSuspendedUntil] = useState('');

  const mayAdjustStatus = accountStatus === 'active' || accountStatus === 'suspended';
  const canBan = accountStatus !== 'banned';
  const canRestore = accountStatus === 'banned';
  const mayAdjustCredits = accountStatus !== 'banned';
  const isLoading = pendingAction !== null;

  function resetCreditInputs() {
    setCreditMinutes('');
    setCustomMinutes('');
    setCreditReason('');
  }

  function openConfirmModal(next: ConfirmModalState) {
    setConfirmReason('');
    setConfirmSuspendedUntil('');
    setConfirmModal(next);
  }

  function runAction(action: string, callback: () => Promise<void>) {
    startTransition(() => {
      void (async () => {
        setPendingAction(action);

        try {
          await callback();
          router.refresh();
          onCompleted?.();
        } catch (error) {
          pushToast({
            tone: 'danger',
            title: 'Action failed',
            description: error instanceof Error ? error.message : 'Unknown error.',
          });
        } finally {
          setPendingAction(null);
        }
      })();
    });
  }

  async function executeStatusChange(
    status: 'active' | 'suspended' | 'banned',
    reason?: string,
    suspendedUntil?: string | null,
  ) {
    const response = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason, suspendedUntil }),
    });
    const payload = await readJson<{ message: string }>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? 'Status change failed.');
    }

    pushToast({ tone: 'success', title: 'Status updated', description: payload.message });
  }

  async function executeCreditChange(deltaSeconds: number, description: string) {
    const response = await fetch(`/api/admin/users/${userId}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deltaSeconds, description }),
    });
    const payload = await readJson<{ message: string }>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? 'Credit change failed.');
    }

    pushToast({ tone: 'success', title: 'Credits updated', description: payload.message });
  }

  async function executeForceEnd() {
    const response = await fetch(`/api/admin/users/${userId}/force-end-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await readJson<{ message: string }>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? 'Force-end session failed.');
    }

    pushToast({ tone: 'success', title: 'Session ended', description: payload.message });
  }

  function handleConfirmAction() {
    if (!confirmModal) {
      return;
    }

    if (confirmModal.requiresReason && confirmReason.trim().length < 4) {
      pushToast({
        tone: 'warning',
        title: 'Reason required',
        description: 'Add a short reason so this moderation action is traceable.',
      });
      return;
    }

    const { action } = confirmModal;
    const reason = confirmReason.trim();
    const suspendedUntil =
      action === 'suspend' && confirmSuspendedUntil
        ? new Date(confirmSuspendedUntil).toISOString()
        : null;
    setConfirmModal(null);
    setConfirmReason('');
    setConfirmSuspendedUntil('');

    runAction(action, async () => {
      if (action === 'suspend') {
        return executeStatusChange('suspended', reason, suspendedUntil);
      }
      if (action === 'reactivate') {
        return executeStatusChange('active', reason || undefined);
      }
      if (action === 'ban') {
        return executeStatusChange('banned', reason);
      }
      if (action === 'restore') {
        return executeStatusChange('active', reason || undefined);
      }
      return executeForceEnd();
    });
  }

  function handleAddCredits() {
    const minutes = Number.parseInt(customMinutes || creditMinutes, 10);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      pushToast({
        tone: 'warning',
        title: 'Invalid amount',
        description: 'Enter a positive number of minutes.',
      });
      return;
    }

    setAddModal(false);
    runAction('add', () =>
      executeCreditChange(
        minutes * 60,
        creditReason.trim() || `Admin credit adjustment +${minutes} minutes`,
      ),
    );
    resetCreditInputs();
  }

  function handleDeductCredits() {
    const minutes = Number.parseInt(customMinutes || creditMinutes, 10);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      pushToast({
        tone: 'warning',
        title: 'Invalid amount',
        description: 'Enter a positive number of minutes.',
      });
      return;
    }

    setDeductModal(false);
    runAction('deduct', () =>
      executeCreditChange(
        minutes * -60,
        creditReason.trim() || `Admin credit adjustment -${minutes} minutes`,
      ),
    );
    resetCreditInputs();
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {mayAdjustStatus && !canRestore && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              openConfirmModal(
                accountStatus === 'active'
                  ? {
                      action: 'suspend',
                      title: 'Suspend Account',
                      message: 'This locks the wallet, ends any live session, and blocks portal access until reactivated.',
                      confirmLabel: 'Suspend',
                      danger: true,
                      requiresReason: true,
                      reasonPlaceholder: 'Support issue, billing hold, misuse...',
                      supportsSuspendedUntil: true,
                    }
                  : {
                      action: 'reactivate',
                      title: 'Reactivate Account',
                      message: 'This restores portal access and unlocks the wallet for future sessions.',
                      confirmLabel: 'Reactivate',
                      reasonPlaceholder: 'Issue resolved, payment received...',
                    },
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/40 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface/80 disabled:opacity-50"
          >
            {isLoading && (pendingAction === 'suspend' || pendingAction === 'reactivate') ? (
              <Loader2 size={11} className="animate-spin" />
            ) : accountStatus === 'active' ? (
              <ShieldOff size={11} />
            ) : (
              <ShieldCheck size={11} />
            )}
            {accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
          </button>
        )}

        {canBan && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              openConfirmModal({
                action: 'ban',
                title: 'Ban User',
                message: 'Banning permanently locks the account and wallet. Use this only for severe abuse or fraud cases.',
                confirmLabel: 'Ban Permanently',
                danger: true,
                requiresReason: true,
                reasonPlaceholder: 'Fraud, abusive behavior, repeated violation...',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {isLoading && pendingAction === 'ban' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <AlertTriangle size={11} />
            )}
            Ban
          </button>
        )}

        {canRestore && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              openConfirmModal({
                action: 'restore',
                title: 'Restore Banned Account',
                message: 'This returns the banned account to active status and unlocks the wallet.',
                confirmLabel: 'Restore Account',
                reasonPlaceholder: 'Appeal approved, review completed...',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
          >
            {isLoading && pendingAction === 'restore' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <ShieldCheck size={11} />
            )}
            Restore
          </button>
        )}

        <Link
          href={`/admin/users/${userId}/sessions`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/40 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface/80"
        >
          <Eye size={11} />
          Sessions
        </Link>

        {mayAdjustCredits && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              resetCreditInputs();
              setAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/40 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface/80 disabled:opacity-50"
          >
            {isLoading && pendingAction === 'add' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Plus size={11} />
            )}
            Add
          </button>
        )}

        {mayAdjustCredits && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              resetCreditInputs();
              setDeductModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/40 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface/80 disabled:opacity-50"
          >
            {isLoading && pendingAction === 'deduct' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Minus size={11} />
            )}
            Deduct
          </button>
        )}

        {hasActiveSession ? (
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              openConfirmModal({
                action: 'force_end',
                title: 'Force-End Session',
                message: 'This immediately ends the live session and stops credit consumption.',
                confirmLabel: 'Force End',
                danger: true,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            {isLoading && pendingAction === 'force_end' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Square size={11} />
            )}
            Stop
          </button>
        ) : null}
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Credits">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a preset or enter a custom amount to add to this user&apos;s wallet.
          </p>

          <div className="grid grid-cols-4 gap-2">
            {CREDIT_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                onClick={() => {
                  setCreditMinutes(String(preset.minutes));
                  setCustomMinutes('');
                }}
                className={`rounded-xl border py-2.5 text-sm font-medium transition-all ${
                  creditMinutes === String(preset.minutes) && !customMinutes
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border/50 bg-surface/30 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Custom minutes</label>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 45"
              value={customMinutes}
              onChange={(event) => {
                setCustomMinutes(event.target.value);
                setCreditMinutes('');
              }}
              className="h-10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reason</label>
            <Input
              type="text"
              placeholder="Bonus credit, support adjustment..."
              value={creditReason}
              onChange={(event) => setCreditReason(event.target.value)}
              className="h-10"
            />
          </div>

          {creditMinutes || customMinutes ? (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
              <p className="text-sm font-medium text-green-400">
                +{customMinutes || creditMinutes} minutes will be added
              </p>
            </div>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAddModal(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-accent hover:bg-accent/90" onClick={handleAddCredits} disabled={!creditMinutes && !customMinutes}>
              <Plus size={14} />
              Add Credits
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deductModal} onClose={() => setDeductModal(false)} title="Deduct Credits">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a preset or enter a custom amount to remove. If the balance reaches zero, any live session stops automatically.
          </p>

          <div className="grid grid-cols-4 gap-2">
            {CREDIT_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                onClick={() => {
                  setCreditMinutes(String(preset.minutes));
                  setCustomMinutes('');
                }}
                className={`rounded-xl border py-2.5 text-sm font-medium transition-all ${
                  creditMinutes === String(preset.minutes) && !customMinutes
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-border/50 bg-surface/30 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Custom minutes</label>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 45"
              value={customMinutes}
              onChange={(event) => {
                setCustomMinutes(event.target.value);
                setCreditMinutes('');
              }}
              className="h-10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reason</label>
            <Input
              type="text"
              placeholder="Correction, penalty, refund adjustment..."
              value={creditReason}
              onChange={(event) => setCreditReason(event.target.value)}
              className="h-10"
            />
          </div>

          {creditMinutes || customMinutes ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-sm font-medium text-red-400">
                -{customMinutes || creditMinutes} minutes will be deducted
              </p>
            </div>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDeductModal(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-red-500 text-white hover:bg-red-600" onClick={handleDeductCredits} disabled={!creditMinutes && !customMinutes}>
              <Minus size={14} />
              Deduct Credits
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmModal !== null} onClose={() => setConfirmModal(null)} title={confirmModal?.title ?? ''}>
        {confirmModal ? (
          <div className="space-y-5">
            <div className={`rounded-xl border p-4 ${confirmModal.danger ? 'border-red-500/20 bg-red-500/5' : 'border-border/50 bg-surface/30'}`}>
              <p className="text-sm text-muted-foreground">{confirmModal.message}</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {confirmModal.requiresReason ? 'Reason (required)' : 'Reason (optional)'}
              </label>
              <Textarea
                value={confirmReason}
                onChange={(event) => setConfirmReason(event.target.value)}
                placeholder={confirmModal.reasonPlaceholder ?? 'Add extra context for the audit trail...'}
                className="min-h-[110px]"
              />
            </div>

            {confirmModal.supportsSuspendedUntil ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Suspend until (optional)
                </label>
                <Input
                  type="datetime-local"
                  value={confirmSuspendedUntil}
                  onChange={(event) => setConfirmSuspendedUntil(event.target.value)}
                  className="h-10"
                />
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmModal(null)}>
                Cancel
              </Button>
              <Button
                className={`flex-1 ${confirmModal.danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-accent hover:bg-accent/90'}`}
                onClick={handleConfirmAction}
              >
                {confirmModal.confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
