import { Badge } from '@study-assistant/ui';

import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { AdminUsersSearch } from '@/features/admin/admin-users-search';
import { getAdminUsersPageData } from '@/features/admin/server';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageUser(['admin', 'super_admin']);
  const params = searchParams ? await searchParams : undefined;
  const result = await getAdminUsersPageData(params);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="User Management"
        title="Users"
        description="Search client and admin accounts, inspect wallet balances, and perform controlled account actions."
        actions={
          <Badge tone="accent" className="text-sm px-4 py-1.5">
            {result.summary.totalUsers} registered user{result.summary.totalUsers === 1 ? '' : 's'}
          </Badge>
        }
      />
      <AdminUsersSearch
        users={result.users.map((user) => ({
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
          joinedAtIso: user.joinedAtIso,
          hasActiveSession: user.hasActiveSession,
          remainingSeconds: user.remainingSeconds,
          lifetimeSecondsPurchased: user.lifetimeSecondsPurchased,
          lifetimeSecondsUsed: user.lifetimeSecondsUsed,
          lastActiveAt: user.lastActiveAt,
          lastActiveLabel: user.lastActiveLabel,
          lowCredit: user.lowCredit,
          packageName: user.packageName,
          paymentStatus: user.paymentStatus,
          nextCreditExpiryAt: user.nextCreditExpiryAt,
          expiringCreditSeconds: user.expiringCreditSeconds,
          flags: user.flags,
        }))}
        totalCount={result.totalCount}
        totalPages={result.totalPages}
        page={result.page}
        pageSize={result.pageSize}
        filters={result.filters}
        summary={result.summary}
      />
    </div>
  );
}
