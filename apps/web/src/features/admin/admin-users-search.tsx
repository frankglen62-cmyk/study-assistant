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
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH BY NAME, EMAIL, OR ROLE..."
          className="h-14 rounded-none bg-surface pl-12 text-sm font-medium border border-border/40 focus:border-accent shadow-card placeholder:text-muted-foreground/50 transition-colors hover:bg-background"
        />
      </div>

      {/* Results count */}
      {search.trim() && (
        <p className="text-xs font-medium text-muted-foreground">
          Showing {filtered.length} of {users.length} user{users.length === 1 ? '' : 's'}
        </p>
      )}

      {/* Table */}
      <div className="border border-border/40 bg-background shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm border-collapse">
            <thead className="bg-surface border-b-4 border-border">
              <tr>
                {['Name', 'Email', 'Role', 'Wallet', 'Status', 'Joined', 'Activity', 'Actions'].map((col) => (
                  <th key={col} className="px-5 py-4 font-medium text-foreground ">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-border font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-muted-foreground font-medium bg-surface/50">
                    {search.trim() ? 'No users match your search.' : 'No users are available yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="bg-background transition-colors hover:bg-accent/10 group">
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <div className="space-y-1">
                        <p className="font-bold text-base text-foreground group-hover:text-black">{user.name}</p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">{`Sessions: ${user.sessionCount}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top font-mono text-muted-foreground border-r-2 border-border/50">{user.email}</td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <Badge tone="neutral" className="rounded-xl border border-border/40/50 bg-surface text-xs font-medium">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <div className="space-y-1">
                        <p className="font-display font-black text-lg">{user.walletBalance}</p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">{user.walletStatus}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <StatusBadge status={user.accountStatus} />
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{user.joinedAt}</p>
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">{user.lastSessionAt}</td>
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
