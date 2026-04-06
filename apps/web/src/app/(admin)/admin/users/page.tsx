import { Badge } from '@study-assistant/ui';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { requirePageUser } from '@/lib/auth/page-context';
import { AdminUserActions } from '@/features/admin/admin-user-actions';
import { AdminUsersSearch } from '@/features/admin/admin-users-search';
import { getAdminUsersPageData } from '@/features/admin/server';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  await requirePageUser(['admin', 'super_admin']);
  const users = await getAdminUsersPageData();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="User Management"
        title="Users"
        description="Search client and admin accounts, inspect wallet balances, and perform controlled account actions."
        actions={
          <Badge tone="accent" className="text-sm px-4 py-1.5">
            {users.length} registered user{users.length === 1 ? '' : 's'}
          </Badge>
        }
      />
      <AdminUsersSearch
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          walletBalance: user.walletBalance,
          walletStatus: user.walletStatus,
          accountStatus: user.accountStatus,
          lastSessionAt: user.lastSessionAt,
          sessionCount: user.sessionCount,
          joinedAt: user.joinedAt,
          hasActiveSession: user.hasActiveSession,
        }))}
      />
    </div>
  );
}
