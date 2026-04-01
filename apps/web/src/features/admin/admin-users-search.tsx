'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Badge, Button, Card, Input, cn } from '@study-assistant/ui';

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
}

export function AdminUsersSearch({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, search]);

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or role..."
          className="h-10 rounded-xl bg-surface/30 pl-10 text-sm border border-border/40 focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
        />
      </div>

      {/* Results count */}
      {search.trim() && (
        <p className="text-xs font-medium text-muted-foreground">
          Showing {filtered.length} of {users.length} user{users.length === 1 ? '' : 's'}
        </p>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border/40 bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border/60 bg-surface/50">
              <tr>
                {['Name', 'Email', 'Role', 'Wallet', 'Status', 'Joined', 'Activity', 'Actions'].map((col) => (
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
                    {search.trim() ? 'No users match your search.' : 'No users are available yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-surface/30 group">
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{`${user.sessionCount} session${user.sessionCount === 1 ? '' : 's'}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-muted-foreground">{user.email}</td>
                    <td className="px-5 py-4 align-top">
                      <Badge tone="neutral">
                        {user.role}
                      </Badge>
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
                      <p className="text-xs text-muted-foreground">{user.joinedAt}</p>
                    </td>
                    <td className="px-5 py-4 align-top text-xs text-muted-foreground">{user.lastSessionAt}</td>
                    <td className="px-5 py-4 align-top">
                      <AdminUserActions userId={user.id} accountStatus={user.accountStatus} />
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
