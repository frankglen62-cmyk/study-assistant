'use client';

import type {
  AdminPaymentPackageCreateRequest,
  AdminPaymentPackageSummary,
  AdminPaymentPackageUpdateRequest,
  PaymentStatus,
} from '@study-assistant/shared-types';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Eye,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

import { formatCurrency, formatDuration, timeAgo } from '@study-assistant/shared-utils';
import { Badge, Button, Input, Textarea, cn } from '@study-assistant/ui';

import { FormField } from '@/components/forms/form-field';
import { StatusBadge } from '@/components/status-badge';
import { formatPaymentPackageDurationLabel } from '@/lib/payments/package-display';
import { useToast } from '@/components/providers/toast-provider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PaymentTab = 'history' | 'packages';
type StatusFilter = 'all' | PaymentStatus;
type ProviderFilter = 'all' | 'paymongo' | 'stripe';

interface PaymentRow {
  id: string;
  userId: string;
  createdAt: string;
  createdAtIso: string;
  paidAt: string | null;
  paidAtIso: string | null;
  userName: string;
  userEmail: string;
  provider: string;
  providerPaymentId: string;
  packageName: string;
  packageCode: string | null;
  amountMinor: number;
  currency: string;
  amount: string;
  status: PaymentStatus;
  paymentType: string;
}

interface StatusCounts {
  total: number;
  paid: number;
  pending: number;
  failed: number;
  canceled: number;
  refunded: number;
}

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function readJson<T>(response: Response) {
  return response.json() as Promise<T & { error?: string }>;
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function readDurationLabel(hoursToCredit: string) {
  const parsedHours = Number.parseFloat(hoursToCredit);
  if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
    return 'Enter hours to preview the credited study time.';
  }
  return `${formatPaymentPackageDurationLabel(parsedHours * 3600)} of active study time`;
}

const STATUS_COLORS: Record<PaymentStatus, string> = {
  paid: 'text-green-400',
  pending: 'text-yellow-400',
  failed: 'text-red-400',
  canceled: 'text-muted-foreground',
  refunded: 'text-orange-400',
};

const AUTO_REFRESH_INTERVAL_MS = 30_000;

/* ------------------------------------------------------------------ */
/*  Payment Detail Modal                                               */
/* ------------------------------------------------------------------ */

function PaymentDetailModal({
  payment,
  onClose,
  onMarkReviewed,
  markingReviewed,
}: {
  payment: PaymentRow;
  onClose: () => void;
  onMarkReviewed: () => void;
  markingReviewed: boolean;
}) {
  const fields = [
    { label: 'Payment ID', value: payment.id },
    { label: 'User', value: `${payment.userName} (${payment.userEmail})` },
    { label: 'Provider', value: payment.provider.toUpperCase() },
    { label: 'Provider Ref', value: payment.providerPaymentId },
    { label: 'Package', value: `${payment.packageName}${payment.packageCode ? ` (${payment.packageCode})` : ''}` },
    { label: 'Amount', value: payment.amount },
    { label: 'Status', value: payment.status },
    { label: 'Type', value: payment.paymentType },
    { label: 'Created', value: `${payment.createdAt} (${timeAgo(payment.createdAtIso)})` },
    { label: 'Paid', value: payment.paidAt ? `${payment.paidAt} (${timeAgo(payment.paidAtIso)})` : 'Not paid yet' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border/50 bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border/40 p-6">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Payment Details</p>
            <h3 className="text-lg font-semibold text-foreground">{payment.packageName}</h3>
            <p className="text-sm text-muted-foreground">{payment.userName} · {payment.amount}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 p-6">
          {fields.map((field) => (
            <div key={field.label} className="flex items-start justify-between gap-4">
              <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
              <span className="text-right text-sm text-foreground">{field.value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-border/40 p-6">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={onMarkReviewed} disabled={markingReviewed}>
            {markingReviewed ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Mark Reviewed
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AdminPaymentsManager({
  payments: initialPayments,
  packages,
  statusCounts: initialCounts,
}: {
  payments: PaymentRow[];
  packages: AdminPaymentPackageSummary[];
  statusCounts: StatusCounts;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startPageTransition] = useTransition();

  // Tabs
  const [activeTab, setActiveTab] = useState<PaymentTab>('history');

  // History state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const autoRefreshRef = useRef(autoRefresh);
  autoRefreshRef.current = autoRefresh;

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (autoRefreshRef.current) {
        startPageTransition(() => { router.refresh(); });
      }
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [autoRefresh, router]);

  // Filter payments client-side
  const filteredPayments = useMemo(() => {
    let result = initialPayments;

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (providerFilter !== 'all') {
      result = result.filter((p) => p.provider === providerFilter);
    }

    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.userName.toLowerCase().includes(needle) ||
          p.userEmail.toLowerCase().includes(needle) ||
          p.packageName.toLowerCase().includes(needle) ||
          p.providerPaymentId.toLowerCase().includes(needle) ||
          p.amount.toLowerCase().includes(needle),
      );
    }

    return result;
  }, [initialPayments, statusFilter, providerFilter, search]);

  function handleManualRefresh() {
    setRefreshing(true);
    startPageTransition(() => { router.refresh(); });
    setTimeout(() => setRefreshing(false), 1000);
  }

  async function handleMarkReviewed() {
    if (!selectedPayment) return;

    setMarkingReviewed(true);
    try {
      // Write to audit log via a POST
      const response = await fetch('/api/admin/payments/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: selectedPayment.id }),
      });
      const payload = await readJson<{ message: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to mark as reviewed.');
      }

      pushToast({
        tone: 'success',
        title: 'Marked as reviewed',
        description: payload.message,
      });
      setSelectedPayment(null);
      startPageTransition(() => { router.refresh(); });
    } catch (error) {
      pushToast({
        tone: 'danger',
        title: 'Review failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    } finally {
      setMarkingReviewed(false);
    }
  }

  function exportPayments() {
    if (filteredPayments.length === 0) {
      pushToast({ tone: 'warning', title: 'No payments', description: 'Nothing to export.' });
      return;
    }

    const csv = [
      ['Date', 'User', 'Email', 'Package', 'Provider', 'Provider Ref', 'Amount', 'Status', 'Paid At'].map(csvEscape).join(','),
      ...filteredPayments.map((p) =>
        [p.createdAt, p.userName, p.userEmail, p.packageName, p.provider, p.providerPaymentId, p.amount, p.status, p.paidAt ?? 'N/A']
          .map((v) => csvEscape(String(v)))
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // Status filter options with counts
  const statusOptions: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: initialCounts.total },
    { key: 'paid', label: 'Paid', count: initialCounts.paid },
    { key: 'pending', label: 'Pending', count: initialCounts.pending },
    { key: 'failed', label: 'Failed', count: initialCounts.failed },
    { key: 'canceled', label: 'Canceled', count: initialCounts.canceled },
    { key: 'refunded', label: 'Refunded', count: initialCounts.refunded },
  ];

  /* ================================================================ */
  /*  HISTORY TAB                                                      */
  /* ================================================================ */
  function renderHistoryTab() {
    return (
      <div className="space-y-5">
        {/* Search + Controls */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, package, or provider ref..."
              className="h-11 bg-surface/20 pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isPending}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-all hover:border-accent hover:text-accent disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', (refreshing || isPending) && 'animate-spin')} />
              </button>
              <button
                type="button"
                onClick={() => setAutoRefresh((v) => !v)}
                className={cn(
                  'inline-flex h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-all',
                  autoRefresh
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', autoRefresh ? 'bg-accent animate-pulse' : 'bg-muted-foreground/40')} />
                Live
              </button>
            </div>

            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value as ProviderFilter)}
              className="h-11 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="all">All providers</option>
              <option value="paymongo">PayMongo</option>
              <option value="stripe">Stripe</option>
            </select>

            <Button size="sm" variant="secondary" className="h-11 px-4" onClick={exportPayments}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {statusOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setStatusFilter(option.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                statusFilter === option.key
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border/40 bg-surface/30 text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {option.label}
              <span className={cn(
                'ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                statusFilter === option.key
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface/60 text-muted-foreground',
              )}>
                {option.count}
              </span>
            </button>
          ))}
        </div>

        {/* Loading bar */}
        {isPending ? (
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-surface/40">
            <div className="h-full w-1/3 rounded-full bg-accent/60" style={{ animation: 'shimmer 1.2s ease-in-out infinite alternate' }} />
          </div>
        ) : null}

        {/* Results count */}
        <p className="text-xs text-muted-foreground">
          {filteredPayments.length} of {initialPayments.length} payment{initialPayments.length === 1 ? '' : 's'} shown
          {search.trim() ? ` · Filtered by "${search.trim()}"` : ''}
        </p>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-border/40">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border/60 bg-surface/50">
                <tr>
                  {['Date', 'User', 'Package', 'Provider', 'Amount', 'Status', 'Actions'].map((col) => (
                    <th key={col} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface/40">
                          <CreditCard className="h-7 w-7 text-muted-foreground/60" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">No payments found</p>
                          <p className="text-xs text-muted-foreground">
                            {search.trim()
                              ? `No results for "${search.trim()}".`
                              : statusFilter !== 'all'
                                ? `No ${statusFilter} payments.`
                                : 'No payments have been recorded yet.'}
                          </p>
                        </div>
                        {(statusFilter !== 'all' || search.trim()) ? (
                          <Button size="sm" variant="secondary" onClick={() => { setSearch(''); setStatusFilter('all'); setProviderFilter('all'); }}>
                            Clear filters
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-surface/25',
                        isPending && 'opacity-60',
                      )}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button')) return;
                        setSelectedPayment(payment);
                      }}
                    >
                      <td className="px-5 py-3.5 align-top">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">{timeAgo(payment.createdAtIso)}</p>
                          <p className="text-[11px] text-muted-foreground">{payment.createdAt}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground">{payment.userName}</p>
                          <p className="text-xs text-muted-foreground">{payment.userEmail}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{payment.packageName}</p>
                          {payment.packageCode ? (
                            <p className="text-[11px] text-muted-foreground">{payment.packageCode}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <Badge tone="neutral">{payment.provider}</Badge>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <p className={cn('font-semibold', payment.status === 'paid' ? 'text-green-400' : 'text-foreground')}>
                          {payment.amount}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <StatusBadge status={payment.status} />
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 px-3 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPayment(payment);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  PACKAGES TAB (reuses existing package manager logic)             */
  /* ================================================================ */
  function renderPackagesTab() {
    return <PackageManagerContent packages={packages} />;
  }

  /* ================================================================ */
  /*  MAIN RENDER                                                      */
  /* ================================================================ */
  return (
    <>
      <div className="space-y-5 rounded-3xl border border-border/40 bg-background p-5 shadow-card">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-border/40">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all',
              activeTab === 'history'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            <CreditCard className="h-4 w-4" />
            Payment History
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface/60 px-1.5 text-[10px] font-bold text-muted-foreground">
              {initialCounts.total}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('packages')}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all',
              activeTab === 'packages'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            <Package className="h-4 w-4" />
            Credit Packages
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface/60 px-1.5 text-[10px] font-bold text-muted-foreground">
              {packages.length}
            </span>
          </button>
        </div>

        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'packages' && renderPackagesTab()}
      </div>

      {/* Detail modal */}
      {selectedPayment ? (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onMarkReviewed={handleMarkReviewed}
          markingReviewed={markingReviewed}
        />
      ) : null}
    </>
  );
}

/* ================================================================ */
/*  PACKAGE MANAGER CONTENT (extracted inline for tab use)           */
/* ================================================================ */

interface PackageDraft {
  code?: string;
  name: string;
  description: string;
  hoursToCredit: string;
  amountDisplay: string;
  isActive: boolean;
  sortOrder: string;
  creditExpiresAfterDays: string;
}

function buildPackageDraft(paymentPackage: AdminPaymentPackageSummary): PackageDraft {
  return {
    name: paymentPackage.name,
    description: paymentPackage.description,
    hoursToCredit: String(paymentPackage.minutesToCredit / 60),
    amountDisplay: paymentPackage.amountDisplay,
    isActive: paymentPackage.isActive,
    sortOrder: String(paymentPackage.sortOrder),
    creditExpiresAfterDays: paymentPackage.creditExpiresAfterDays?.toString() ?? '',
  };
}

const emptyPackageDraft: PackageDraft = {
  code: '',
  name: '',
  description: '',
  hoursToCredit: '1',
  amountDisplay: '4.99',
  isActive: true,
  sortOrder: '0',
  creditExpiresAfterDays: '',
};

function PackageManagerContent({ packages }: { packages: AdminPaymentPackageSummary[] }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>(() =>
    Object.fromEntries(packages.map((p) => [p.id, buildPackageDraft(p)])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [newPackageDraft, setNewPackageDraft] = useState<PackageDraft>({ ...emptyPackageDraft });
  const [createPending, setCreatePending] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    setDrafts(Object.fromEntries(packages.map((p) => [p.id, buildPackageDraft(p)])));
  }, [packages]);

  function updateDraft(packageId: string, partial: Partial<PackageDraft>) {
    setDrafts((current) => {
      const original = packages.find((p) => p.id === packageId);
      const existing = current[packageId] ?? (original ? buildPackageDraft(original) : null);
      if (!existing) return current;
      return { ...current, [packageId]: { ...existing, ...partial } };
    });
  }

  function resetDraft(packageId: string) {
    const original = packages.find((p) => p.id === packageId);
    if (!original) return;
    setDrafts((current) => ({ ...current, [packageId]: buildPackageDraft(original) }));
  }

  function validateDraft(draft: PackageDraft) {
    const priceMajor = Number.parseFloat(draft.amountDisplay);
    const parsedHours = Number.parseFloat(draft.hoursToCredit);
    const minutesToCredit = Math.max(1, Math.round((Number.isFinite(parsedHours) ? parsedHours : 0) * 60));
    const sortOrder = Number.parseInt(draft.sortOrder, 10);
    const creditExpiresAfterDays = draft.creditExpiresAfterDays.trim()
      ? Number.parseInt(draft.creditExpiresAfterDays, 10)
      : null;

    if (!draft.name.trim()) throw new Error('Package name is required.');
    if (!Number.isFinite(priceMajor) || priceMajor <= 0) throw new Error('Valid price required.');
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) throw new Error('Valid hours required.');
    if (!Number.isFinite(sortOrder) || sortOrder < 0) throw new Error('Sort order must be 0 or above.');
    if (creditExpiresAfterDays !== null && (!Number.isFinite(creditExpiresAfterDays) || creditExpiresAfterDays <= 0)) {
      throw new Error('Credit expiry days must be positive.');
    }

    return {
      code: (draft.code?.trim()) || undefined,
      name: draft.name.trim(),
      description: draft.description.trim(),
      minutesToCredit,
      priceMajor,
      isActive: draft.isActive,
      sortOrder,
      creditExpiresAfterDays,
    };
  }

  async function sendMutation(url: string, options: RequestInit, success: { title: string; description: string }, failTitle: string) {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });
    const payload = await readJson<{ message: string }>(response);
    if (!response.ok) throw new Error(payload.error ?? failTitle);
    pushToast({ tone: 'success', title: success.title, description: payload.message || success.description });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Create new package toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Credit Packages</h3>
          <p className="text-xs text-muted-foreground">Manage the packages visible on the buy-credits page.</p>
        </div>
        <Button size="sm" variant={showNewForm ? 'secondary' : 'primary'} onClick={() => setShowNewForm((v) => !v)}>
          {showNewForm ? 'Cancel' : 'New Package'}
        </Button>
      </div>

      {/* Create new package form */}
      {showNewForm ? (
        <div className="rounded-2xl border border-dashed border-accent/30 bg-accent/5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Create Package</h3>
              <p className="text-xs text-muted-foreground">PHP currency · PayMongo integration</p>
            </div>
            <Badge>PHP</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Package code" description="Internal slug like one-hour.">
              <Input
                value={newPackageDraft.code ?? ''}
                onChange={(e) => setNewPackageDraft((c) => ({ ...c, code: e.target.value }))}
                disabled={createPending}
                placeholder="weekend-pass"
              />
            </FormField>
            <FormField label="Package name">
              <Input
                value={newPackageDraft.name}
                onChange={(e) => setNewPackageDraft((c) => ({ ...c, name: e.target.value }))}
                disabled={createPending}
                placeholder="Weekend Pass"
              />
            </FormField>
            <FormField label="Price (PHP)">
              <Input
                type="number" min="0.01" step="0.01"
                value={newPackageDraft.amountDisplay}
                onChange={(e) => setNewPackageDraft((c) => ({ ...c, amountDisplay: e.target.value }))}
                disabled={createPending}
              />
            </FormField>
            <FormField label="Credit duration (hours)">
              <Input
                type="number" min={0.1} step="any"
                value={newPackageDraft.hoursToCredit}
                onChange={(e) => setNewPackageDraft((c) => ({ ...c, hoursToCredit: e.target.value }))}
                disabled={createPending}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Client sees: {readDurationLabel(newPackageDraft.hoursToCredit)}.
              </p>
            </FormField>
            <FormField label="Sort order">
              <Input
                type="number" min={0}
                value={newPackageDraft.sortOrder}
                onChange={(e) => setNewPackageDraft((c) => ({ ...c, sortOrder: e.target.value }))}
                disabled={createPending}
              />
            </FormField>
            <FormField label="Credit expiry (days)" description="Leave blank for no expiry.">
              <Input
                type="number" min={1}
                value={newPackageDraft.creditExpiresAfterDays}
                onChange={(e) => setNewPackageDraft((c) => ({ ...c, creditExpiresAfterDays: e.target.value }))}
                disabled={createPending}
                placeholder="No expiry"
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Description">
                <Textarea
                  value={newPackageDraft.description}
                  onChange={(e) => setNewPackageDraft((c) => ({ ...c, description: e.target.value }))}
                  className="min-h-[80px]"
                  disabled={createPending}
                  placeholder="Optional package description..."
                />
              </FormField>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox" className="h-4 w-4 rounded border-border bg-background"
                checked={newPackageDraft.isActive}
                onChange={(e) => setNewPackageDraft((c) => ({ ...c, isActive: e.target.checked }))}
                disabled={createPending}
              />
              Show on buy-credits page
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={createPending} onClick={() => setNewPackageDraft({ ...emptyPackageDraft })}>
                Reset
              </Button>
              <Button
                size="sm"
                disabled={createPending}
                onClick={() => {
                  let payload: AdminPaymentPackageCreateRequest;
                  try {
                    payload = validateDraft(newPackageDraft);
                  } catch (error) {
                    pushToast({ tone: 'warning', title: 'Validation error', description: error instanceof Error ? error.message : 'Invalid.' });
                    return;
                  }

                  startTransition(() => {
                    void (async () => {
                      setCreatePending(true);
                      try {
                        await sendMutation('/api/admin/payment-packages', { method: 'POST', body: JSON.stringify(payload) }, { title: 'Created', description: 'Package created.' }, 'Create failed.');
                        setNewPackageDraft({ ...emptyPackageDraft });
                        setShowNewForm(false);
                      } catch (error) {
                        pushToast({ tone: 'danger', title: 'Create failed', description: error instanceof Error ? error.message : 'Error.' });
                      } finally {
                        setCreatePending(false);
                      }
                    })();
                  });
                }}
              >
                {createPending ? 'Creating...' : 'Create Package'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Existing packages */}
      {packages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/40 bg-surface/20 px-5 py-16 text-center">
          <Package className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">No packages yet</p>
          <p className="text-xs text-muted-foreground">Create your first credit package above.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {packages.map((pkg) => {
            const draft = drafts[pkg.id];
            if (!draft) return null;

            const isDirty =
              (draft.code ?? '') !== (pkg.code ?? '') ||
              draft.name !== pkg.name ||
              draft.description !== pkg.description ||
              draft.amountDisplay !== pkg.amountDisplay ||
              draft.hoursToCredit !== String(pkg.minutesToCredit / 60) ||
              draft.isActive !== pkg.isActive ||
              draft.sortOrder !== String(pkg.sortOrder) ||
              draft.creditExpiresAfterDays !== (pkg.creditExpiresAfterDays?.toString() ?? '');

            return (
              <div key={pkg.id} className="rounded-2xl border border-border/50 bg-background/70 p-5 shadow-soft-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">{pkg.code || pkg.name}</h3>
                  <Badge tone={draft.isActive ? 'success' : 'warning'}>{draft.isActive ? 'Active' : 'Hidden'}</Badge>
                  <Badge>{pkg.currency}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {pkg.currency} {draft.amountDisplay || '0.00'} for {readDurationLabel(draft.hoursToCredit).toLowerCase()}.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="Package code">
                    <Input
                      value={draft.code || ''}
                      onChange={(e) => updateDraft(pkg.id, { code: e.target.value })}
                      disabled={pendingId === pkg.id}
                    />
                  </FormField>
                  <FormField label="Package name">
                    <Input value={draft.name} onChange={(e) => updateDraft(pkg.id, { name: e.target.value })} disabled={pendingId === pkg.id} />
                  </FormField>
                  <FormField label={`Price (${pkg.currency})`}>
                    <Input type="number" min="0.01" step="0.01" value={draft.amountDisplay} onChange={(e) => updateDraft(pkg.id, { amountDisplay: e.target.value })} disabled={pendingId === pkg.id} />
                  </FormField>
                  <FormField label="Credit duration (hours)">
                    <Input type="number" min={0.1} step="any" value={draft.hoursToCredit} onChange={(e) => updateDraft(pkg.id, { hoursToCredit: e.target.value })} disabled={pendingId === pkg.id} />
                    <p className="mt-1 text-xs text-muted-foreground">Client sees: {readDurationLabel(draft.hoursToCredit)}</p>
                  </FormField>
                  <FormField label="Sort order">
                    <Input type="number" min={0} value={draft.sortOrder} onChange={(e) => updateDraft(pkg.id, { sortOrder: e.target.value })} disabled={pendingId === pkg.id} />
                  </FormField>
                  <FormField label="Credit expiry (days)">
                    <Input type="number" min={1} value={draft.creditExpiresAfterDays} onChange={(e) => updateDraft(pkg.id, { creditExpiresAfterDays: e.target.value })} disabled={pendingId === pkg.id} placeholder="No expiry" />
                  </FormField>
                  <div className="md:col-span-2">
                    <FormField label="Description">
                      <Textarea value={draft.description} onChange={(e) => updateDraft(pkg.id, { description: e.target.value })} className="min-h-[80px]" disabled={pendingId === pkg.id} />
                    </FormField>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/40 bg-surface/30 px-4 py-3">
                  <label className="flex items-center gap-3 text-sm text-foreground">
                    <input type="checkbox" className="h-4 w-4 rounded border-border bg-background" checked={draft.isActive} onChange={(e) => updateDraft(pkg.id, { isActive: e.target.checked })} disabled={pendingId === pkg.id} />
                    Show on buy-credits page
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={pendingId === pkg.id || !isDirty} onClick={() => resetDraft(pkg.id)}>
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      disabled={pendingId === pkg.id || !isDirty}
                      onClick={() => {
                        let payload: AdminPaymentPackageUpdateRequest;
                        try { payload = validateDraft(draft); } catch (error) {
                          pushToast({ tone: 'warning', title: 'Validation error', description: error instanceof Error ? error.message : 'Invalid.' });
                          return;
                        }
                        startTransition(() => {
                          void (async () => {
                            setPendingId(pkg.id);
                            try {
                              await sendMutation(`/api/admin/payment-packages/${pkg.id}`, { method: 'PATCH', body: JSON.stringify(payload) }, { title: 'Saved', description: 'Package saved.' }, 'Save failed.');
                            } catch (error) {
                              pushToast({ tone: 'danger', title: 'Save failed', description: error instanceof Error ? error.message : 'Error.' });
                            } finally {
                              setPendingId(null);
                            }
                          })();
                        });
                      }}
                    >
                      {pendingId === pkg.id ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pendingId === pkg.id}
                      onClick={() => {
                        if (!confirm(`Delete "${pkg.code}"? Use Hide instead for packages that already have payment history.`)) return;
                        startTransition(() => {
                          void (async () => {
                            setPendingId(pkg.id);
                            try {
                              await sendMutation(`/api/admin/payment-packages/${pkg.id}`, { method: 'DELETE', body: JSON.stringify({}) }, { title: 'Deleted', description: 'Package deleted.' }, 'Delete failed.');
                            } catch (error) {
                              pushToast({ tone: 'danger', title: 'Delete failed', description: error instanceof Error ? error.message : 'Error.' });
                            } finally {
                              setPendingId(null);
                            }
                          })();
                        });
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
