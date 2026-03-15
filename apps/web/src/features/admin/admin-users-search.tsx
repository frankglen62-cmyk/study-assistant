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
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or role..."
          className="h-10 rounded-full bg-surface/50 pl-9 text-sm border-border/50 focus:border-accent"
        />
      </div>

      {/* Results count */}
      {search.trim() && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {users.length} user{users.length === 1 ? '' : 's'}
        </p>
      )}

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/70 text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Name', 'Email', 'Role', 'Wallet', 'Status', 'Joined', 'Activity', 'Actions'].map((col) => (
                  <th key={col} className="px-5 py-4 font-medium text-muted-foreground">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                    {search.trim() ? 'No users match your search.' : 'No users are available yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className={cn('bg-surface/70 transition hover:bg-muted/30')}>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{`Sessions in sample: ${user.sessionCount}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">{user.email}</td>
                    <td className="px-5 py-4 align-top">{user.role}</td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{user.walletBalance}</p>
                        <p className="text-xs text-muted-foreground">{`Wallet ${user.walletStatus}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <StatusBadge status={user.accountStatus} />
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="text-sm text-muted-foreground">{user.joinedAt}</p>
                    </td>
                    <td className="px-5 py-4 align-top">{user.lastSessionAt}</td>
                    <td className="px-5 py-4 align-top">
                      <AdminUserActions userId={user.id} accountStatus={user.accountStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
