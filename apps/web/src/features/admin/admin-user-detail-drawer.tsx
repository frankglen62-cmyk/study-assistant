'use client';

import type {
  AdminUserAccessOverrideRequest,
  AdminUserAccessOverrideResponse,
  AdminUserDetailResponse,
  AdminUserDeviceRevokeResponse,
  AdminUserFlagMutationResponse,
  AdminUserNoteMutationResponse,
} from '@study-assistant/shared-types';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { timeAgo } from '@study-assistant/shared-utils';
import { Badge, Button, Input, Textarea, cn } from '@study-assistant/ui';

import { StatusBadge } from '@/components/status-badge';
import { useToast } from '@/components/providers/toast-provider';

type DrawerTab = 'overview' | 'wallet' | 'activity' | 'access' | 'admin';

const DRAWER_TABS: Array<{ key: DrawerTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'activity', label: 'Activity' },
  { key: 'access', label: 'Access' },
  { key: 'admin', label: 'Admin' },
];

function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/40 bg-surface/20 p-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T & { error?: string };
}

function secondsToMinutesField(value: number | null) {
  if (value === null) {
    return '';
  }

  return String(Math.round(value / 60));
}

function parseOptionalPositiveInt(value: string, fieldLabel: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel} must be a positive number.`);
  }

  return parsed;
}

export function AdminUserDetailDrawer({
  open,
  onClose,
  detail,
  loading,
  error,
  onMutated,
}: {
  open: boolean;
  onClose: () => void;
  detail: AdminUserDetailResponse | null;
  loading: boolean;
  error: string | null;
  onMutated?: () => void;
}) {
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');

  const [noteValue, setNoteValue] = useState('');
  const [flagValue, setFlagValue] = useState('');
  const [flagColor, setFlagColor] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [removingFlagId, setRemovingFlagId] = useState<string | null>(null);
  const [canUseExtension, setCanUseExtension] = useState(true);
  const [canBuyCredits, setCanBuyCredits] = useState(true);
  const [maxActiveDevices, setMaxActiveDevices] = useState('');
  const [dailyUsageLimitMinutes, setDailyUsageLimitMinutes] = useState('');
  const [monthlyUsageLimitMinutes, setMonthlyUsageLimitMinutes] = useState('');
  const [featureFlagsText, setFeatureFlagsText] = useState('');

  useEffect(() => {
    if (!detail) {
      return;
    }

    setCanUseExtension(detail.access.canUseExtension);
    setCanBuyCredits(detail.access.canBuyCredits);
    setMaxActiveDevices(detail.access.maxActiveDevices?.toString() ?? '');
    setDailyUsageLimitMinutes(secondsToMinutesField(detail.access.dailyUsageLimitSeconds));
    setMonthlyUsageLimitMinutes(secondsToMinutesField(detail.access.monthlyUsageLimitSeconds));
    setFeatureFlagsText(detail.access.featureFlags.join(', '));
  }, [detail]);

  // Reset tab when opening a new user
  useEffect(() => {
    if (open) {
      setActiveTab('overview');
    }
  }, [open, detail?.user?.id]);

  if (!open) {
    return null;
  }

  async function handleAddNote() {
    if (!detail) {
      return;
    }

    if (noteValue.trim().length < 4) {
      pushToast({
        tone: 'warning',
        title: 'Note too short',
        description: 'Add a short internal note before saving.',
      });
      return;
    }

    setNoteSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${detail.user.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteValue.trim() }),
      });
      const payload = await readJson<AdminUserNoteMutationResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save admin note.');
      }

      setNoteValue('');
      pushToast({
        tone: 'success',
        title: 'Note added',
        description: payload.message,
      });
      onMutated?.();
    } catch (mutationError) {
      pushToast({
        tone: 'danger',
        title: 'Note failed',
        description:
          mutationError instanceof Error ? mutationError.message : 'Failed to save admin note.',
      });
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function handleAddFlag() {
    if (!detail) {
      return;
    }

    if (flagValue.trim().length < 2) {
      pushToast({
        tone: 'warning',
        title: 'Flag too short',
        description: 'Use a short label such as VIP, Trial, or Overdue.',
      });
      return;
    }

    setFlagSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${detail.user.id}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flag: flagValue.trim(),
          color: flagColor.trim() || null,
        }),
      });
      const payload = await readJson<AdminUserFlagMutationResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to add flag.');
      }

      setFlagValue('');
      setFlagColor('');
      pushToast({
        tone: 'success',
        title: 'Flag added',
        description: payload.message,
      });
      onMutated?.();
    } catch (mutationError) {
      pushToast({
        tone: 'danger',
        title: 'Flag failed',
        description: mutationError instanceof Error ? mutationError.message : 'Failed to add flag.',
      });
    } finally {
      setFlagSubmitting(false);
    }
  }

  async function handleRemoveFlag(flagId: string) {
    if (!detail) {
      return;
    }

    setRemovingFlagId(flagId);

    try {
      const response = await fetch(`/api/admin/users/${detail.user.id}/flags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId }),
      });
      const payload = await readJson<AdminUserFlagMutationResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to remove flag.');
      }

      pushToast({
        tone: 'success',
        title: 'Flag removed',
        description: payload.message,
      });
      onMutated?.();
    } catch (mutationError) {
      pushToast({
        tone: 'danger',
        title: 'Remove failed',
        description:
          mutationError instanceof Error ? mutationError.message : 'Failed to remove flag.',
      });
    } finally {
      setRemovingFlagId(null);
    }
  }

  async function handleSaveAccess() {
    if (!detail) {
      return;
    }

    let requestBody: AdminUserAccessOverrideRequest;

    try {
      const maxDevices = parseOptionalPositiveInt(maxActiveDevices, 'Max active devices');
      const dailyMinutes = parseOptionalPositiveInt(dailyUsageLimitMinutes, 'Daily limit');
      const monthlyMinutes = parseOptionalPositiveInt(monthlyUsageLimitMinutes, 'Monthly limit');

      requestBody = {
        canUseExtension,
        canBuyCredits,
        maxActiveDevices: maxDevices,
        dailyUsageLimitSeconds: dailyMinutes === null ? null : dailyMinutes * 60,
        monthlyUsageLimitSeconds: monthlyMinutes === null ? null : monthlyMinutes * 60,
        featureFlags: featureFlagsText
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      };
    } catch (validationError) {
      pushToast({
        tone: 'warning',
        title: 'Invalid access settings',
        description:
          validationError instanceof Error
            ? validationError.message
            : 'Please correct the access form.',
      });
      return;
    }

    setAccessSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${detail.user.id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const payload = await readJson<AdminUserAccessOverrideResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save access overrides.');
      }

      pushToast({
        tone: 'success',
        title: 'Access saved',
        description: payload.message,
      });
      onMutated?.();
    } catch (mutationError) {
      pushToast({
        tone: 'danger',
        title: 'Access failed',
        description:
          mutationError instanceof Error
            ? mutationError.message
            : 'Failed to save access overrides.',
      });
    } finally {
      setAccessSubmitting(false);
    }
  }

  async function handleRevokeDevice(installationId?: string) {
    if (!detail) {
      return;
    }

    const revokeAll = !installationId;
    setRevokingDeviceId(installationId ?? 'all');

    try {
      const response = await fetch(`/api/admin/users/${detail.user.id}/devices/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          revokeAll
            ? { revokeAll: true }
            : { installationId },
        ),
      });
      const payload = await readJson<AdminUserDeviceRevokeResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to revoke device.');
      }

      pushToast({
        tone: 'success',
        title: revokeAll ? 'Devices revoked' : 'Device revoked',
        description: payload.message,
      });
      onMutated?.();
    } catch (mutationError) {
      pushToast({
        tone: 'danger',
        title: 'Revoke failed',
        description:
          mutationError instanceof Error ? mutationError.message : 'Failed to revoke device.',
      });
    } finally {
      setRevokingDeviceId(null);
    }
  }

  const activeDeviceCount = detail?.devices.filter((device) => device.installationStatus === 'active').length ?? 0;

  /* ------------------------------------------------------------------ */
  /*  Tab content renderers                                              */
  /* ------------------------------------------------------------------ */

  function renderOverview() {
    if (!detail) return null;
    return (
      <div className="space-y-5">
        {/* Metric cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {detail.metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-border/40 bg-background p-4 shadow-card">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
              <p className="mt-2 text-xs text-muted-foreground">{metric.helper}</p>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-background/60 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{detail.sessions.length}</p>
            <p className="text-xs text-muted-foreground">Recent sessions</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/60 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{detail.payments.length}</p>
            <p className="text-xs text-muted-foreground">Payments</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/60 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{activeDeviceCount}</p>
            <p className="text-xs text-muted-foreground">Active devices</p>
          </div>
        </div>

        {/* Recent audit preview */}
        <DetailSection
          title="Recent Audit"
          description="Latest admin-visible changes attached to this account."
        >
          {detail.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent audit entries for this user.</p>
          ) : (
            <div className="space-y-2">
              {detail.auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="rounded-xl border border-border/40 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{log.summary}</p>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(log.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {log.event} · {log.entity} · {log.actor}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      </div>
    );
  }

  function renderWallet() {
    if (!detail) return null;
    return (
      <div className="space-y-5">
        <DetailSection
          title="Wallet Ledger"
          description="Latest wallet movements, including admin adjustments and usage deductions."
        >
          {detail.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet transactions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-xl border border-border/40 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={transaction.deltaLabel.startsWith('+') ? 'success' : 'warning'}>
                        {transaction.transactionType}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">{transaction.deltaLabel}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(transaction.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">{transaction.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Balance after: {transaction.balanceAfterLabel}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection
          title="Wallet Grants"
          description="Credit buckets that may expire independently from the total wallet balance."
        >
          {detail.walletGrants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet grants recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.walletGrants.map((grant) => (
                <div key={grant.id} className="rounded-xl border border-border/40 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          grant.status === 'active'
                            ? 'success'
                            : grant.status === 'expired'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {grant.status}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">{grant.remainingLabel}</span>
                      <span className="text-xs text-muted-foreground">of {grant.totalLabel}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {grant.expiresAt ? `Expires ${grant.expiresAt}` : 'No expiry'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">{grant.description}</p>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      </div>
    );
  }

  function renderActivity() {
    if (!detail) return null;
    return (
      <div className="space-y-5">
        <DetailSection
          title="Recent Sessions"
          description="Most recent billed or live study windows for this user."
        >
          {detail.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-border/40 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{session.siteDomain}</p>
                      <p className="text-xs text-muted-foreground">{session.subject}</p>
                    </div>
                    <StatusBadge status={session.status} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {timeAgo(session.startedAt)} · {session.creditsUsed} · {session.analyzeCount} analyze
                  </p>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Payments" description="Recent package purchases and payment outcomes.">
          {detail.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded for this user.</p>
          ) : (
            <div className="space-y-2">
              {detail.payments.map((payment) => (
                <div key={payment.id} className="rounded-xl border border-border/40 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{payment.packageName}</p>
                      <p className="text-xs text-muted-foreground">{payment.provider}</p>
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">{payment.amount}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(payment.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      </div>
    );
  }

  function renderAccess() {
    if (!detail) return null;
    return (
      <div className="space-y-5">
        <DetailSection
          title="Access Controls"
          description="Per-user controls for extension access, payments, device caps, and feature flags."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/60 p-4">
              <input
                type="checkbox"
                checked={canUseExtension}
                onChange={(event) => setCanUseExtension(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border bg-background"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">Allow extension</span>
                <span className="block text-xs text-muted-foreground">
                  When disabled, pairing and extension usage should be blocked.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/60 p-4">
              <input
                type="checkbox"
                checked={canBuyCredits}
                onChange={(event) => setCanBuyCredits(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border bg-background"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">Allow credit purchases</span>
                <span className="block text-xs text-muted-foreground">
                  Disable new topups when billing or account restrictions apply.
                </span>
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Max active devices</label>
              <Input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={maxActiveDevices}
                onChange={(event) => setMaxActiveDevices(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Daily limit in minutes</label>
              <Input
                type="number"
                min="1"
                placeholder="No limit"
                value={dailyUsageLimitMinutes}
                onChange={(event) => setDailyUsageLimitMinutes(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Monthly limit in minutes</label>
              <Input
                type="number"
                min="1"
                placeholder="No limit"
                value={monthlyUsageLimitMinutes}
                onChange={(event) => setMonthlyUsageLimitMinutes(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Feature flags</label>
            <Input
              type="text"
              placeholder="exam_mode, premium_search, support_override"
              value={featureFlagsText}
              onChange={(event) => setFeatureFlagsText(event.target.value)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Comma-separated feature keys. Leave blank if this user has no custom feature overrides.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/60 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Current override snapshot</p>
              <p className="text-xs text-muted-foreground">
                Last updated {detail.access.updatedAt ? timeAgo(detail.access.updatedAt) : 'not yet saved'}
              </p>
            </div>
            <Button size="sm" onClick={handleSaveAccess} disabled={accessSubmitting}>
              {accessSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save access
            </Button>
          </div>
        </DetailSection>

        <DetailSection
          title="Devices"
          description="Paired extension installations and revoke controls."
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/60 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Active devices</p>
              <p className="text-xs text-muted-foreground">
                {activeDeviceCount} active of {detail.devices.length} paired installation{detail.devices.length === 1 ? '' : 's'}.
              </p>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleRevokeDevice()}
              disabled={activeDeviceCount === 0 || revokingDeviceId === 'all'}
            >
              {revokingDeviceId === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Revoke all active
            </Button>
          </div>

          {detail.devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paired devices found.</p>
          ) : (
            <div className="space-y-2">
              {detail.devices.map((device) => {
                const isRevokingThisDevice = revokingDeviceId === device.id;

                return (
                  <div key={device.id} className="rounded-xl border border-border/40 bg-background/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {device.deviceName ?? 'Unknown device'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {device.browserName ?? 'Unknown browser'}
                          {device.extensionVersion ? ` · v${device.extensionVersion}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={device.installationStatus} />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRevokeDevice(device.id)}
                          disabled={
                            device.installationStatus !== 'active' || isRevokingThisDevice || revokingDeviceId === 'all'
                          }
                        >
                          {isRevokingThisDevice ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Revoke
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Last seen {device.lastSeenAt ? timeAgo(device.lastSeenAt) : 'never'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </DetailSection>

        <DetailSection
          title="Flags"
          description="Quick admin labels for support, risk, billing, or customer segmentation."
        >
          {detail.flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No internal flags assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {detail.flags.map((flag) => (
                <span
                  key={flag.id}
                  className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-background px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  {flag.flag}
                  <button
                    type="button"
                    onClick={() => handleRemoveFlag(flag.id)}
                    disabled={removingFlagId === flag.id}
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    aria-label={`Remove ${flag.flag} flag`}
                  >
                    {removingFlagId === flag.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
            <Input
              value={flagValue}
              onChange={(event) => setFlagValue(event.target.value)}
              placeholder="VIP, Trial, Overdue..."
            />
            <Input
              value={flagColor}
              onChange={(event) => setFlagColor(event.target.value)}
              placeholder="Optional color"
            />
            <Button size="sm" onClick={handleAddFlag} disabled={flagSubmitting}>
              {flagSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add flag
            </Button>
          </div>
        </DetailSection>
      </div>
    );
  }

  function renderAdmin() {
    if (!detail) return null;
    return (
      <div className="space-y-5">
        <DetailSection
          title="Admin Notes"
          description="Internal-only notes for support handoff, review outcomes, or billing context."
        >
          <Textarea
            value={noteValue}
            onChange={(event) => setNoteValue(event.target.value)}
            placeholder="Add a private note for future admins..."
            className="min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAddNote} disabled={noteSubmitting}>
              {noteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save note
            </Button>
          </div>

          {detail.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No internal notes yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.notes.map((note) => (
                <div key={note.id} className="rounded-xl border border-border/40 bg-background/70 p-3">
                  <p className="text-sm text-foreground">{note.note}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {note.createdByName} · {note.createdByEmail} · {timeAgo(note.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection
          title="Full Audit Trail"
          description="Complete admin-visible changes attached to this account or wallet."
        >
          {detail.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent audit entries for this user.</p>
          ) : (
            <div className="space-y-2">
              {detail.auditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-border/40 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{log.summary}</p>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(log.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {log.event} · {log.entity} · {log.actor}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-border/40 bg-background shadow-soft-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 px-6 pb-0 pt-6 backdrop-blur-sm sm:px-8">
          <div className="flex items-start justify-between gap-4 pb-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">User Details</p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  {detail?.user.name ?? 'Loading user'}
                </h2>
                {detail ? <StatusBadge status={detail.user.accountStatus} /> : null}
                {detail ? <Badge tone="neutral">{detail.user.role}</Badge> : null}
                {detail?.user.lowCredit ? <Badge tone="warning">Low credits</Badge> : null}
                {detail?.user.hasActiveSession ? <Badge tone="success">Live now</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {detail?.user.email ?? 'Fetching user context...'}
              </p>
              {detail ? (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>Joined {timeAgo(detail.user.joinedAtIso)}</span>
                  <span>·</span>
                  <span>Last active {timeAgo(detail.user.lastActiveAt)}</span>
                  {detail.user.packageName ? (
                    <>
                      <span>·</span>
                      <span>{detail.user.packageName}{detail.user.paymentStatus ? ` (${detail.user.paymentStatus})` : ''}</span>
                    </>
                  ) : null}
                </div>
              ) : null}
              {detail?.user.statusReason ? (
                <p className="text-xs text-muted-foreground">
                  Moderation: {detail.user.statusReason}
                </p>
              ) : null}
              {detail?.user.suspendedUntil ? (
                <p className="text-xs text-muted-foreground">
                  Suspension ends: {detail.user.suspendedUntil}
                </p>
              ) : null}
            </div>
            <Button variant="secondary" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>

          {/* Tab bar */}
          {detail ? (
            <div className="flex gap-0.5 overflow-x-auto -mb-px">
              {DRAWER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold transition-all',
                    activeTab === tab.key
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {tab.label}
                  {tab.key === 'wallet' && detail.transactions.length > 0 ? (
                    <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-surface/60 px-1 text-[10px] font-bold text-muted-foreground">
                      {detail.transactions.length}
                    </span>
                  ) : null}
                  {tab.key === 'activity' && detail.sessions.length > 0 ? (
                    <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-surface/60 px-1 text-[10px] font-bold text-muted-foreground">
                      {detail.sessions.length}
                    </span>
                  ) : null}
                  {tab.key === 'admin' && detail.notes.length > 0 ? (
                    <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-surface/60 px-1 text-[10px] font-bold text-muted-foreground">
                      {detail.notes.length}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Tab content */}
        <div className="px-6 py-6 sm:px-8">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 rounded-full border border-border/40 bg-surface/30 px-5 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading user details...
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
              {error}
            </div>
          ) : detail ? (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'wallet' && renderWallet()}
              {activeTab === 'activity' && renderActivity()}
              {activeTab === 'access' && renderAccess()}
              {activeTab === 'admin' && renderAdmin()}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
