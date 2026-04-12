'use client';

import type {
  AdminBulkUserActionRequest,
  AdminBulkUserActionResponse,
  AdminUserDetailResponse,
  AdminUserSummary,
  AdminUsersFilterState,
  AdminUsersQuickFilter,
  AdminUsersRoleFilter,
  AdminUsersSortMode,
  AdminUsersSummary,
} from '@study-assistant/shared-types';
import type { Route } from 'next';

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Circle, Download, Filter, Minus, Search, ShieldOff, Plus, X } from 'lucide-react';

import { formatDuration } from '@study-assistant/shared-utils';
import { Badge, Button, Input, Textarea, cn } from '@study-assistant/ui';

import { MetricCard } from '@/components/metric-card';
import { useToast } from '@/components/providers/toast-provider';
import { StatusBadge } from '@/components/status-badge';
import { AdminUserActions } from '@/features/admin/admin-user-actions';
import { AdminUserDetailDrawer } from '@/features/admin/admin-user-detail-drawer';

type BulkAction = 'suspend' | 'add_credits' | 'deduct_credits';

const FILTER_OPTIONS: Array<{ key: AdminUsersQuickFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live Now' },
  { key: 'low_credit', label: 'Low Credits' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'banned', label: 'Banned' },
];

async function readJson<T>(response: Response) {
  return (await response.json()) as T & { error?: string };
}

function toRoute(pathname: string, queryString: string) {
  return (queryString ? `${pathname}?${queryString}` : pathname) as Route;
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildUsersQuery(params: {
  filters: AdminUsersFilterState;
  page: number;
  pageSize: number;
}) {
  const searchParams = new URLSearchParams();

  if (params.filters.q.trim()) {
    searchParams.set('q', params.filters.q.trim());
  }

  if (params.filters.role !== 'all') {
    searchParams.set('role', params.filters.role);
  }

  if (params.filters.quickFilter !== 'all') {
    searchParams.set('filter', params.filters.quickFilter);
  }

  if (params.filters.sort !== 'recent_joined') {
    searchParams.set('sort', params.filters.sort);
  }

  if (params.page > 1) {
    searchParams.set('page', String(params.page));
  }

  if (params.pageSize !== 20) {
    searchParams.set('pageSize', String(params.pageSize));
  }

  return searchParams.toString();
}

function BulkModal({
  open,
  title,
  description,
  action,
  requiresMinutes,
  reason,
  minutes,
  onReasonChange,
  onMinutesChange,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  title: string;
  description: string;
  action: BulkAction | null;
  requiresMinutes: boolean;
  reason: string;
  minutes: string;
  onReasonChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  if (!open || !action) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border/50 bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-surface/50 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {requiresMinutes ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Minutes</label>
              <Input
                type="number"
                min="1"
                value={minutes}
                onChange={(event) => onMinutesChange(event.target.value)}
                placeholder="e.g. 60"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reason</label>
            <Textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Add the reason that should appear in the audit trail..."
              className="min-h-[120px]"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              variant={action === 'suspend' || action === 'deduct_credits' ? 'danger' : 'primary'}
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? 'Working...' : 'Apply'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminUsersSearch({
  users,
  totalCount,
  totalPages,
  page,
  pageSize,
  filters,
  summary,
}: {
  users: AdminUserSummary[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  filters: AdminUsersFilterState;
  summary: AdminUsersSummary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { pushToast } = useToast();

  const [search, setSearch] = useState(filters.q);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AdminUserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkMinutes, setBulkMinutes] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setSearch(filters.q);
  }, [filters.q]);

  useEffect(() => {
    setSelectedIds([]);
  }, [users]);

  useEffect(() => {
    if (deferredSearch === filters.q) {
      return;
    }

    const queryString = buildUsersQuery({
      filters: {
        ...filters,
        q: deferredSearch,
      },
      page: 1,
      pageSize,
    });

    startTransition(() => {
      router.replace(toRoute(pathname, queryString), { scroll: false });
    });
  }, [deferredSearch, filters, pageSize, pathname, router]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);

    void (async () => {
      try {
        const response = await fetch(`/api/admin/users/${selectedUserId}`, {
          signal: controller.signal,
        });
        const payload = await readJson<AdminUserDetailResponse>(response);

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load user details.');
        }

        setSelectedDetail(payload);
      } catch (error) {
        if (!controller.signal.aborted) {
          setDetailError(error instanceof Error ? error.message : 'Failed to load user details.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [detailRefreshKey, selectedUserId]);

  const metrics = useMemo(
    () => [
      {
        label: 'Total Users',
        value: String(summary.totalUsers),
        delta: `${summary.adminsCount} admin account${summary.adminsCount === 1 ? '' : 's'}`,
        tone: 'accent' as const,
      },
      {
        label: 'Live Now',
        value: String(summary.liveNow),
        delta: 'Users with active sessions',
        tone: 'success' as const,
      },
      {
        label: 'Low Credits',
        value: String(summary.lowCredits),
        delta: '30 minutes or less remaining',
        tone: 'warning' as const,
      },
      {
        label: 'Suspended',
        value: String(summary.suspended),
        delta: 'Wallet locked by moderation',
        tone: 'warning' as const,
      },
    ],
    [summary],
  );

  const allPageSelected = users.length > 0 && users.every((user) => selectedIds.includes(user.id));

  function replaceQuery(partial: Partial<AdminUsersFilterState> & { page?: number }) {
    const nextFilters: AdminUsersFilterState = {
      ...filters,
      ...partial,
    };
    const nextPage = partial.page ?? 1;
    const queryString = buildUsersQuery({
      filters: nextFilters,
      page: nextPage,
      pageSize,
    });

    startTransition(() => {
      router.replace(toRoute(pathname, queryString), { scroll: false });
    });
  }

  function handleDetailRefresh() {
    router.refresh();
    setDetailRefreshKey((value) => value + 1);
  }

  function toggleSelected(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function toggleSelectAllCurrentPage() {
    if (allPageSelected) {
      setSelectedIds((current) => current.filter((id) => !users.some((user) => user.id === id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...users.map((user) => user.id)])));
  }

  function openBulkAction(action: BulkAction) {
    setBulkAction(action);
    setBulkReason('');
    setBulkMinutes('');
  }

  async function submitBulkAction() {
    if (!bulkAction) {
      return;
    }

    if (selectedIds.length === 0) {
      pushToast({
        tone: 'warning',
        title: 'No users selected',
        description: 'Select at least one user before applying a bulk action.',
      });
      return;
    }

    if (bulkReason.trim().length < 4) {
      pushToast({
        tone: 'warning',
        title: 'Reason required',
        description: 'Add a short reason so the bulk action is traceable.',
      });
      return;
    }

    if (
      (bulkAction === 'add_credits' || bulkAction === 'deduct_credits') &&
      (!Number.isFinite(Number.parseInt(bulkMinutes, 10)) || Number.parseInt(bulkMinutes, 10) <= 0)
    ) {
      pushToast({
        tone: 'warning',
        title: 'Minutes required',
        description: 'Enter a positive minute amount for bulk credit actions.',
      });
      return;
    }

    setBulkSubmitting(true);

    try {
      const payload: AdminBulkUserActionRequest = {
        userIds: selectedIds,
        action: bulkAction,
        reason: bulkReason.trim(),
        ...(bulkAction === 'add_credits' || bulkAction === 'deduct_credits'
          ? { minutes: Number.parseInt(bulkMinutes, 10) }
          : {}),
      };
      const response = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await readJson<AdminBulkUserActionResponse>(response);

      if (!response.ok) {
        throw new Error(result.error ?? 'Bulk action failed.');
      }

      pushToast({
        tone: result.failures.length === 0 ? 'success' : 'warning',
        title: 'Bulk action finished',
        description: result.message,
      });
      setSelectedIds([]);
      setBulkAction(null);
      setBulkReason('');
      setBulkMinutes('');
      handleDetailRefresh();
    } catch (error) {
      pushToast({
        tone: 'danger',
        title: 'Bulk action failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    } finally {
      setBulkSubmitting(false);
    }
  }

  function exportSelectedUsers() {
    const rows = users.filter((user) => selectedIds.includes(user.id));

    if (rows.length === 0) {
      pushToast({
        tone: 'warning',
        title: 'No users selected',
        description: 'Select users first before exporting CSV.',
      });
      return;
    }

    const csv = [
      ['Name', 'Email', 'Role', 'Status', 'Plan', 'Payment Status', 'Credits', 'Next Credit Expiry', 'Last Active', 'Joined', 'Flags'].map(csvEscape).join(','),
      ...rows.map((user) =>
        [
          user.name,
          user.email,
          user.role,
          user.accountStatus,
          user.packageName ?? 'No package',
          user.paymentStatus ?? 'None',
          user.walletBalance,
          user.nextCreditExpiryAt ?? 'None',
          user.lastActiveLabel,
          user.joinedAt,
          user.flags.map((flag) => flag.flag).join(' | '),
        ]
          .map((value) => csvEscape(String(value)))
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              delta={metric.delta}
              tone={metric.tone}
            />
          ))}
        </div>

        <div className="space-y-5 rounded-3xl border border-border/40 bg-background p-5 shadow-card">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, role, or flag..."
                className="h-11 bg-surface/20 pl-10"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <select
                value={filters.role}
                onChange={(event) =>
                  replaceQuery({
                    role: event.target.value as AdminUsersRoleFilter,
                    page: 1,
                  })
                }
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="all">All roles</option>
                <option value="client">Clients</option>
                <option value="admin">Admins</option>
                <option value="super_admin">Super admins</option>
              </select>

              <select
                value={filters.sort}
                onChange={(event) =>
                  replaceQuery({
                    sort: event.target.value as AdminUsersSortMode,
                    page: 1,
                  })
                }
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="recent_joined">Newest joined</option>
                <option value="activity_recent">Recent activity</option>
                <option value="credits_low">Lowest credits</option>
                <option value="credits_high">Highest credits</option>
                <option value="name_az">Name A-Z</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() =>
                  replaceQuery({
                    quickFilter: option.key,
                    page: 1,
                  })
                }
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                  filters.quickFilter === option.key
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border/40 bg-surface/30 text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                {option.key === 'live' && summary.liveNow > 0 ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                ) : null}
                {option.label}
              </button>
            ))}
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {selectedIds.length} user{selectedIds.length === 1 ? '' : 's'} selected
                </p>
                <p className="text-xs text-muted-foreground">Apply bulk admin actions or export the selected rows.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" className="h-9 px-3" onClick={() => openBulkAction('suspend')}>
                  <ShieldOff className="h-4 w-4" />
                  Suspend
                </Button>
                <Button size="sm" variant="secondary" className="h-9 px-3" onClick={() => openBulkAction('add_credits')}>
                  <Plus className="h-4 w-4" />
                  Add Credits
                </Button>
                <Button size="sm" variant="secondary" className="h-9 px-3" onClick={() => openBulkAction('deduct_credits')}>
                  <Minus className="h-4 w-4" />
                  Deduct Credits
                </Button>
                <Button size="sm" variant="secondary" className="h-9 px-3" onClick={exportSelectedUsers}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button size="sm" variant="secondary" className="h-9 px-3" onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Showing {users.length} of {totalCount} matching user{totalCount === 1 ? '' : 's'}
            </p>
            <p>
              Page {page} of {totalPages}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/40">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border/60 bg-surface/50">
                  <tr>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllCurrentPage}
                        className="h-4 w-4 rounded border-border bg-background"
                      />
                    </th>
                    {['User', 'Role', 'Plan', 'Credits', 'Status', 'Last Active', 'Joined', 'Actions'].map((column) => (
                      <th key={column} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center text-sm text-muted-foreground">
                        No users match the current search and filters.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr
                        key={user.id}
                        className={cn(
                          'transition-colors hover:bg-surface/25',
                          user.accountStatus === 'banned' && 'opacity-60',
                          selectedUserId === user.id && 'bg-accent/5',
                        )}
                      >
                        <td className="px-4 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(user.id)}
                            onChange={() => toggleSelected(user.id)}
                            className="mt-1 h-4 w-4 rounded border-border bg-background"
                          />
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(user.id)}
                              className="text-left font-semibold text-foreground transition-colors hover:text-accent"
                            >
                              {user.name}
                            </button>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <div className="flex flex-wrap gap-2">
                              {user.hasActiveSession ? <Badge tone="success">Live</Badge> : null}
                              {user.lowCredit ? <Badge tone="warning">Low credits</Badge> : null}
                              {user.nextCreditExpiryAt && user.expiringCreditSeconds > 0 ? (
                                <Badge tone="warning">Expiring credits</Badge>
                              ) : null}
                              {user.flags.slice(0, 3).map((flag) => (
                                <Badge key={flag.id} tone="neutral">
                                  {flag.flag}
                                </Badge>
                              ))}
                              {user.flags.length > 3 ? <Badge tone="neutral">+{user.flags.length - 3}</Badge> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <Badge tone="neutral">{user.role}</Badge>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{user.packageName ?? 'No package yet'}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.paymentStatus ? `Last payment: ${user.paymentStatus}` : 'No payment history'}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{user.walletBalance}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.walletStatus === 'locked'
                                ? 'Wallet locked'
                                : user.nextCreditExpiryAt && user.expiringCreditSeconds > 0
                                  ? `${formatDuration(user.expiringCreditSeconds)} expires next on ${user.nextCreditExpiryAt}`
                                  : `${user.sessionCount} recorded session${user.sessionCount === 1 ? '' : 's'}`}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <StatusBadge status={user.accountStatus} />
                        </td>
                        <td className="px-5 py-4 align-top">
                          {user.hasActiveSession ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                              </span>
                              Live now
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Circle size={8} className="text-muted-foreground/40" />
                              {user.lastActiveLabel}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top text-xs text-muted-foreground">{user.joinedAt}</td>
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 px-3 text-xs"
                              onClick={() => setSelectedUserId(user.id)}
                            >
                              View details
                            </Button>
                            <AdminUserActions
                              userId={user.id}
                              accountStatus={user.accountStatus}
                              hasActiveSession={user.hasActiveSession}
                              onCompleted={handleDetailRefresh}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-surface/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {totalCount === 0
                ? 'No matching users to paginate.'
                : `Showing page ${page} of ${totalPages} with ${pageSize} rows per page.`}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => replaceQuery({ page: page - 1 })}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => replaceQuery({ page: page + 1 })}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <BulkModal
        open={bulkAction !== null}
        title={
          bulkAction === 'suspend'
            ? 'Suspend selected users'
            : bulkAction === 'add_credits'
              ? 'Add credits to selected users'
              : 'Deduct credits from selected users'
        }
        description={
          bulkAction === 'suspend'
            ? 'This will suspend every selected account and end any open sessions.'
            : bulkAction === 'add_credits'
              ? 'This adds the same amount of study time to every selected wallet.'
              : 'This deducts the same amount of study time from every selected wallet.'
        }
        action={bulkAction}
        requiresMinutes={bulkAction === 'add_credits' || bulkAction === 'deduct_credits'}
        reason={bulkReason}
        minutes={bulkMinutes}
        onReasonChange={setBulkReason}
        onMinutesChange={setBulkMinutes}
        onClose={() => setBulkAction(null)}
        onSubmit={submitBulkAction}
        submitting={bulkSubmitting}
      />

      <AdminUserDetailDrawer
        open={selectedUserId !== null}
        onClose={() => setSelectedUserId(null)}
        detail={selectedDetail}
        loading={detailLoading}
        error={detailError}
        onMutated={handleDetailRefresh}
      />
    </>
  );
}
