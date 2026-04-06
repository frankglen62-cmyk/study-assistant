'use client';

import { startTransition, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldOff, ShieldCheck, Eye, Plus, Minus, Square, X, Check,
  Clock, AlertTriangle, Loader2
} from 'lucide-react';

import { Button } from '@study-assistant/ui';
import { useToast } from '@/components/providers/toast-provider';

interface AdminUserActionsProps {
  userId: string;
  accountStatus: 'active' | 'suspended' | 'pending_verification' | 'banned';
  hasActiveSession?: boolean;
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T & { error?: string };
}

/* ─── Modal primitives ─── */
function Modal({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/60 bg-background shadow-2xl ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface/60 hover:text-foreground transition-colors"
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

export function AdminUserActions({ userId, accountStatus, hasActiveSession }: AdminUserActionsProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Modal state
  const [addModal, setAddModal] = useState(false);
  const [deductModal, setDeductModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    action: 'suspend' | 'reactivate' | 'ban' | 'restore' | 'force_end';
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
  } | null>(null);
  const [creditMinutes, setCreditMinutes] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');

  const mayAdjustStatus = accountStatus === 'active' || accountStatus === 'suspended';
  const canBan = accountStatus !== 'banned';
  const canRestore = accountStatus === 'banned';
  const mayAdjustCredits = accountStatus !== 'banned';

  function runAction(action: string, callback: () => Promise<void>) {
    startTransition(() => {
      void (async () => {
        setPendingAction(action);
        try {
          await callback();
          router.refresh();
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

  async function executeStatusChange(status: 'active' | 'suspended' | 'banned') {
    const response = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const payload = await readJson<{ message: string }>(response);
    if (!response.ok) throw new Error(payload.error ?? 'Status change failed.');
    pushToast({ tone: 'success', title: 'Status updated', description: payload.message });
  }

  async function executeCreditChange(deltaSeconds: number, description: string) {
    const response = await fetch(`/api/admin/users/${userId}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deltaSeconds, description }),
    });
    const payload = await readJson<{ message: string }>(response);
    if (!response.ok) throw new Error(payload.error ?? 'Credit change failed.');
    pushToast({ tone: 'success', title: 'Credits updated', description: payload.message });
  }

  async function executeForceEnd() {
    const response = await fetch(`/api/admin/users/${userId}/force-end-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await readJson<{ message: string }>(response);
    if (!response.ok) throw new Error(payload.error ?? 'Force-end session failed.');
    pushToast({ tone: 'success', title: 'Session ended', description: payload.message });
  }

  function handleConfirmAction() {
    if (!confirmModal) return;
    const { action } = confirmModal;
    setConfirmModal(null);

    runAction(action, async () => {
      if (action === 'suspend') return executeStatusChange('suspended');
      if (action === 'reactivate') return executeStatusChange('active');
      if (action === 'ban') return executeStatusChange('banned');
      if (action === 'restore') return executeStatusChange('active');
      if (action === 'force_end') return executeForceEnd();
    });
  }

  function handleAddCredits() {
    const mins = Number.parseInt(customMinutes || creditMinutes, 10);
    if (!Number.isFinite(mins) || mins <= 0) {
      pushToast({ tone: 'warning', title: 'Invalid amount', description: 'Enter a positive number of minutes.' });
      return;
    }
    setAddModal(false);
    setCreditMinutes('');
    setCustomMinutes('');
    setCreditReason('');
    runAction('add', () => executeCreditChange(
      mins * 60,
      creditReason.trim() || `Admin credit adjustment +${mins} minutes`,
    ));
  }

  function handleDeductCredits() {
    const mins = Number.parseInt(customMinutes || creditMinutes, 10);
    if (!Number.isFinite(mins) || mins <= 0) {
      pushToast({ tone: 'warning', title: 'Invalid amount', description: 'Enter a positive number of minutes.' });
      return;
    }
    setDeductModal(false);
    setCreditMinutes('');
    setCustomMinutes('');
    setCreditReason('');
    runAction('deduct', () => executeCreditChange(
      mins * -60,
      creditReason.trim() || `Admin credit adjustment -${mins} minutes`,
    ));
  }

  const isLoading = pendingAction !== null;

  return (
    <>
      {/* ─── Action Buttons ─── */}
      <div className="flex flex-wrap gap-1.5">
        {/* Suspend / Reactivate */}
        {mayAdjustStatus && !canRestore && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setConfirmModal(
              accountStatus === 'active'
                ? { action: 'suspend', title: 'Suspend Account', message: 'This will lock the wallet and stop any active session. The user will be unable to log in.', confirmLabel: 'Suspend', danger: true }
                : { action: 'reactivate', title: 'Reactivate Account', message: 'This will unlock the wallet and restore portal access for this user.', confirmLabel: 'Reactivate' }
            )}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface/80 transition-colors disabled:opacity-50"
            title={accountStatus === 'active' ? 'Suspend user' : 'Reactivate user'}
          >
            {isLoading && pendingAction === 'suspend' || isLoading && pendingAction === 'reactivate'
              ? <Loader2 size={11} className="animate-spin" />
              : accountStatus === 'active' ? <ShieldOff size={11} /> : <ShieldCheck size={11} />
            }
            {accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
          </button>
        )}

        {/* Ban */}
        {canBan && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setConfirmModal({
              action: 'ban',
              title: 'Ban User',
              message: 'Banning permanently locks this account and wallet. The user cannot log in or use any service. This action should only be used for serious violations.',
              confirmLabel: 'Ban Permanently',
              danger: true,
            })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            title="Ban user permanently"
          >
            {isLoading && pendingAction === 'ban' ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
            Ban
          </button>
        )}

        {/* Restore (from banned) */}
        {canRestore && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setConfirmModal({
              action: 'restore',
              title: 'Restore Banned Account',
              message: 'This will restore this banned account to active status and unlock the wallet.',
              confirmLabel: 'Restore Account',
            })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
            title="Restore banned account"
          >
            {isLoading && pendingAction === 'restore' ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
            Restore
          </button>
        )}

        {/* View Sessions */}
        <Link
          href={`/admin/users/${userId}/sessions`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface/80 transition-colors"
          title="View sessions"
        >
          <Eye size={11} />
          Sessions
        </Link>

        {/* Add Credits */}
        {mayAdjustCredits && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => { setCreditMinutes(''); setCustomMinutes(''); setCreditReason(''); setAddModal(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface/80 transition-colors disabled:opacity-50"
            title="Add credits"
          >
            {isLoading && pendingAction === 'add' ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Add
          </button>
        )}

        {/* Deduct Credits */}
        {mayAdjustCredits && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => { setCreditMinutes(''); setCustomMinutes(''); setCreditReason(''); setDeductModal(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface/80 transition-colors disabled:opacity-50"
            title="Deduct credits"
          >
            {isLoading && pendingAction === 'deduct' ? <Loader2 size={11} className="animate-spin" /> : <Minus size={11} />}
            Deduct
          </button>
        )}

        {/* Force End Session */}
        {hasActiveSession && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setConfirmModal({
              action: 'force_end',
              title: 'Force-End Session',
              message: 'This will immediately end the user\'s active session and stop credit consumption.',
              confirmLabel: 'Force End',
              danger: true,
            })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            title="Force-end active session"
          >
            {isLoading && pendingAction === 'force_end' ? <Loader2 size={11} className="animate-spin" /> : <Square size={11} />}
            Stop
          </button>
        )}
      </div>

      {/* ─── Add Credits Modal ─── */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Credits">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Select a preset or enter a custom amount to add to this user's wallet.</p>

          {/* Presets */}
          <div className="grid grid-cols-4 gap-2">
            {CREDIT_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                onClick={() => { setCreditMinutes(String(preset.minutes)); setCustomMinutes(''); }}
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

          {/* Custom */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Custom minutes</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 45"
              value={customMinutes}
              onChange={(e) => { setCustomMinutes(e.target.value); setCreditMinutes(''); }}
              className="h-10 w-full rounded-xl border border-input bg-background/60 px-4 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reason (optional)</label>
            <input
              type="text"
              placeholder="Bonus credit, support adjustment..."
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background/60 px-4 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
          </div>

          {/* Preview */}
          {(creditMinutes || customMinutes) && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
              <p className="text-sm font-medium text-green-400">
                +{customMinutes || creditMinutes} minutes will be added
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-accent hover:bg-accent/90"
              onClick={handleAddCredits}
              disabled={!creditMinutes && !customMinutes}
            >
              <Plus size={14} /> Add Credits
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Deduct Credits Modal ─── */}
      <Modal open={deductModal} onClose={() => setDeductModal(false)} title="Deduct Credits">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Select a preset or enter a custom amount to remove from this user's wallet. If the balance reaches zero, any open session will stop automatically.</p>

          {/* Presets */}
          <div className="grid grid-cols-4 gap-2">
            {CREDIT_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                onClick={() => { setCreditMinutes(String(preset.minutes)); setCustomMinutes(''); }}
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

          {/* Custom */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Custom minutes</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 45"
              value={customMinutes}
              onChange={(e) => { setCustomMinutes(e.target.value); setCreditMinutes(''); }}
              className="h-10 w-full rounded-xl border border-input bg-background/60 px-4 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reason (optional)</label>
            <input
              type="text"
              placeholder="Penalty, correction..."
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background/60 px-4 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
          </div>

          {/* Preview */}
          {(creditMinutes || customMinutes) && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-sm font-medium text-red-400">
                -{customMinutes || creditMinutes} minutes will be deducted
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDeductModal(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeductCredits}
              disabled={!creditMinutes && !customMinutes}
            >
              <Minus size={14} /> Deduct Credits
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Confirm Action Modal ─── */}
      <Modal
        open={confirmModal !== null}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.title ?? ''}
      >
        {confirmModal && (
          <div className="space-y-5">
            <div className={`rounded-xl border p-4 ${confirmModal.danger ? 'border-red-500/20 bg-red-500/5' : 'border-border/50 bg-surface/30'}`}>
              <p className="text-sm text-muted-foreground">{confirmModal.message}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmModal(null)}>
                <X size={14} /> Cancel
              </Button>
              <Button
                className={`flex-1 ${confirmModal.danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-accent hover:bg-accent/90'}`}
                onClick={handleConfirmAction}
              >
                <Check size={14} /> {confirmModal.confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
