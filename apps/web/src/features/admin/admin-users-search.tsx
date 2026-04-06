'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, Circle, Filter } from 'lucide-react';

import { Badge, Input, cn } from '@study-assistant/ui';
import { StatusBadge } from '@/components/status-badge';
import { AdminUserActions } from '@/features/admin/admin-user-actions';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  walletBalance: string;
  walletStatus: string;
  accountStatus: 'active' | 'suspended' | 'pending_verification' | 'banned';
  lastSessionAt: string;
  sessionCount: number;
  joinedAt: string;
  hasActiveSession?: boolean;
}

type FilterMode = 'all' | 'active_session' | 'suspended' | 'banned' | 'low_credits';

const FILTER_OPTIONS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active_session', label: 'Live Session' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'banned', label: 'Banned' },
];

export function AdminUsersSearch({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  const filtered = useMemo(() => {
    let result = users;

    // Status filter
    if (filter === 'active_session') result = result.filter((u) => u.hasActiveSession);
    else if (filter === 'suspended') result = result.filter((u) => u.accountStatus === 'suspended');
    else if (filter === 'banned') result = result.filter((u) => u.accountStatus === 'banned');

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q),
      );
    }

    return result;
  }, [users, search, filter]);

  const activeSessionCount = users.filter((u) => u.hasActiveSession).length;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="h-10 rounded-xl bg-surface/30 pl-10 text-sm border border-border/40 focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                filter === opt.key
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border/40 bg-surface/30 text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {opt.key === 'active_session' && activeSessionCount > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                </span>
              )}
              {opt.label}
              {opt.key === 'active_session' && activeSessionCount > 0 && (
                <span className="ml-0.5 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                  {activeSessionCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      {(search.trim() || filter !== 'all') && (
        <p className="text-xs font-medium text-muted-foreground">
          Showing {filtered.length} of {users.length} user{users.length === 1 ? '' : 's'}
        </p>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border/40 bg-background shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border/60 bg-surface/50">
              <tr>
                {['Name', 'Email', 'Role', 'Wallet', 'Status', 'Session', 'Joined', 'Actions'].map((col) => (
                  <th key={col} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-muted-foreground bg-surface/20">
                    {search.trim() || filter !== 'all' ? 'No users match your search or filter.' : 'No users are available yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className={cn('transition-colors hover:bg-surface/30', user.accountStatus === 'banned' && 'opacity-60')}>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-0.5">
                        <Link
                          href={`/admin/users/${user.id}/sessions`}
                          className="font-medium text-foreground hover:text-accent transition-colors"
                        >
                          {user.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{`${user.sessionCount} session${user.sessionCount === 1 ? '' : 's'}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-muted-foreground">{user.email}</td>
                    <td className="px-5 py-4 align-top">
                      <Badge tone="neutral">{user.role}</Badge>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">{user.walletBalance}</p>
                        <p className="text-xs text-muted-foreground">{user.walletStatus}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <StatusBadge status={user.accountStatus} />
                    </td>
                    <td className="px-5 py-4 align-top">
                      {user.hasActiveSession ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                          </span>
                          Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Circle size={8} className="text-muted-foreground/40" />
                          {user.lastSessionAt}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="text-xs text-muted-foreground">{user.joinedAt}</p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <AdminUserActions
                        userId={user.id}
                        accountStatus={user.accountStatus}
                        hasActiveSession={user.hasActiveSession}
                      />
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
