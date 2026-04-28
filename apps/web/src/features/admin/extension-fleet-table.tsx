'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Search, X } from 'lucide-react';

import { Badge, Input } from '@study-assistant/ui';

import type { AdminExtensionFleetRow } from '@/lib/supabase/admin';
import { formatRelativeTime } from '@/lib/format-relative-time';

type StatusFilter = 'all' | 'active' | 'outdated' | 'idle' | 'revoked';

interface ExtensionFleetTableProps {
  rows: AdminExtensionFleetRow[];
  currentZipVersion: string;
}

const IDLE_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function getRowStatus(row: AdminExtensionFleetRow, currentZipVersion: string): StatusFilter {
  if (row.status === 'revoked' || row.status === 'expired') {
    return 'revoked';
  }
  if (row.lastSeenAt) {
    const lastSeenMs = new Date(row.lastSeenAt).getTime();
    if (!Number.isNaN(lastSeenMs) && Date.now() - lastSeenMs > IDLE_THRESHOLD_MS) {
      return 'idle';
    }
  }
  if (!row.extensionVersion || row.extensionVersion !== currentZipVersion) {
    return 'outdated';
  }
  return 'active';
}

const statusToneMap: Record<StatusFilter, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> =
  {
    active: 'success',
    outdated: 'warning',
    idle: 'neutral',
    revoked: 'danger',
    all: 'accent',
  };

const statusLabelMap: Record<StatusFilter, string> = {
  active: 'Active',
  outdated: 'Outdated',
  idle: 'Idle',
  revoked: 'Revoked',
  all: 'All',
};

export function ExtensionFleetTable({ rows, currentZipVersion }: ExtensionFleetTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const enriched = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        derivedStatus: getRowStatus(row, currentZipVersion),
      })),
    [rows, currentZipVersion],
  );

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: enriched.length,
      active: 0,
      outdated: 0,
      idle: 0,
      revoked: 0,
    };
    for (const row of enriched) {
      base[row.derivedStatus] += 1;
    }
    return base;
  }, [enriched]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return enriched.filter((row) => {
      if (statusFilter !== 'all' && row.derivedStatus !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return [
        row.userEmail,
        row.userFullName,
        row.deviceName,
        row.browserName,
        row.extensionVersion,
      ].some((value) => (value ?? '').toLowerCase().includes(needle));
    });
  }, [enriched, search, statusFilter]);

  const orderedFilters: StatusFilter[] = ['all', 'active', 'outdated', 'idle', 'revoked'];
  const adoptionRate = counts.all === 0 ? 0 : Math.round((counts.active / counts.all) * 100);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/40 bg-background p-4 shadow-card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total installations
          </p>
          <p className="mt-2 font-display text-2xl text-foreground">{counts.all}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Across {new Set(enriched.map((row) => row.userId)).size} unique account
            {new Set(enriched.map((row) => row.userId)).size === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/10 p-4 shadow-card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            On current build
          </p>
          <p className="mt-2 font-display text-2xl text-emerald-800 dark:text-emerald-300">
            {counts.active}
          </p>
          <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
            {adoptionRate}% adoption of v{currentZipVersion}.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/10 p-4 shadow-card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Outdated
          </p>
          <p className="mt-2 font-display text-2xl text-amber-800 dark:text-amber-300">
            {counts.outdated}
          </p>
          <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
            Need to reload the latest ZIP.
          </p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-background p-4 shadow-card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Idle / revoked
          </p>
          <p className="mt-2 font-display text-2xl text-foreground">
            {counts.idle + counts.revoked}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.idle} idle (14d+) · {counts.revoked} revoked.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {orderedFilters.map((filter) => {
          const active = statusFilter === filter;
          return (
            <button
              type="button"
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'border-accent bg-accent text-white shadow-sm'
                  : 'border-border/40 bg-background text-foreground hover:border-accent/40'
              }`}
            >
              {statusLabelMap[filter]}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-surface text-muted-foreground'
                }`}
              >
                {counts[filter]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by email, name, device, or version"
          className="h-10 pl-9 pr-9"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/40 bg-background shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-surface/40">
                <th className="px-5 py-3.5 text-left text-xs font-medium text-muted-foreground">
                  User
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-muted-foreground">
                  Device
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-muted-foreground">
                  Version
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-muted-foreground">
                  Last seen
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No installations match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/20 last:border-0 hover:bg-surface/30"
                  >
                    <td className="px-5 py-3.5 text-sm">
                      <p className="font-medium text-foreground">
                        {row.userFullName ?? 'Unnamed user'}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.userEmail ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground">
                      <p className="font-medium">{row.deviceName ?? 'Unnamed device'}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.browserName ?? 'Browser unknown'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground">
                      <span className="font-mono text-xs">{row.extensionVersion ?? '—'}</span>
                      {row.derivedStatus === 'outdated' ? (
                        <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                          Behind v{currentZipVersion}
                        </p>
                      ) : null}
                      {row.derivedStatus === 'active' ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Up to date
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatRelativeTime(row.lastSeenAt)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={statusToneMap[row.derivedStatus]}>
                        {statusLabelMap[row.derivedStatus]}
                      </Badge>
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
