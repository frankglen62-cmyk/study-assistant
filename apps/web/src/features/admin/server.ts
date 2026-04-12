import 'server-only';

import type {
  AdminUsersFilterState,
  AdminUsersQuickFilter,
  AdminUsersRoleFilter,
  AdminUsersSortMode,
  AdminUsersSummary,
} from '@study-assistant/shared-types';

import {
  confidenceToLevel,
  formatConfidence,
  formatCurrency,
  formatDuration,
  formatDurationDetailed,
} from '@study-assistant/shared-utils';

import {
  countAdminPaymentSummaries,
  countAdminUserRollups,
  countAdminUsers,
  getAdminDashboardSummary,
  getAdminSessionDetail,
  getAdminUserAccessOverride,
  listAdminAuditLogs,
  listAdminCreditTransactionsForUser,
  listAdminCategories,
  listAdminCreditTransactionsForSession,
  listAdminFolders,
  listAdminPaymentPackages,
  listAdminPaymentSummaries,
  listAdminPaymentSummariesForUser,
  listAdminQuestionAttemptsForSession,
  listAdminSessionAttemptSignals,
  listAdminSessionSummaries,
  listAdminSourceFiles,
  listAdminSubjects,
  listAdminUserDevices,
  listAdminUserFlags,
  listAdminUserNotes,
  listAdminUserRollups,
  listAdminUsers,
  listAdminWalletGrantsForUser,
  listAdminWallets,
} from '@/lib/supabase/admin';
import { countAdminSubjectQaPairsBySubjectIds } from '@/lib/supabase/subject-qa';
import { getProfileWithWalletByUserId } from '@/lib/supabase/users';

const DEFAULT_ADMIN_USERS_PAGE_SIZE = 20;

function extractDomainFromUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function extractPathFromUrl(value: string | null | undefined) {
  if (!value) {
    return '/';
  }

  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}` || '/';
  } catch {
    return '/';
  }
}

function mostFrequent(items: Array<string | null | undefined>) {
  const counts = new Map<string, number>();

  for (const item of items) {
    if (!item) {
      continue;
    }

    counts.set(item, (counts.get(item) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function formatSignedDuration(seconds: number) {
  const prefix = seconds >= 0 ? '+' : '-';
  return `${prefix}${formatDuration(Math.abs(seconds))}`;
}

function resolveLastActivityAt(session: { last_activity_at?: string | null; start_time: string; end_time: string | null }) {
  return session.last_activity_at ?? session.end_time ?? session.start_time;
}

function extractEnabledFeatureFlags(flags: Record<string, unknown> | null | undefined) {
  return Object.entries(flags ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
}

function readFirstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function compareNullableDates(left: string | null, right: string | null) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return rightTime - leftTime;
}

export function normalizeAdminUsersQuery(input?: {
  q?: string | string[];
  role?: string | string[];
  filter?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
}) {
  const q = readFirstQueryValue(input?.q)?.trim() ?? '';
  const roleValue = readFirstQueryValue(input?.role);
  const filterValue = readFirstQueryValue(input?.filter);
  const sortValue = readFirstQueryValue(input?.sort);
  const pageValue = Number.parseInt(readFirstQueryValue(input?.page) ?? '1', 10);
  const pageSizeValue = Number.parseInt(
    readFirstQueryValue(input?.pageSize) ?? String(DEFAULT_ADMIN_USERS_PAGE_SIZE),
    10,
  );

  const role: AdminUsersRoleFilter =
    roleValue === 'client' || roleValue === 'admin' || roleValue === 'super_admin'
      ? roleValue
      : 'all';
  const quickFilter: AdminUsersQuickFilter =
    filterValue === 'live' ||
    filterValue === 'suspended' ||
    filterValue === 'banned' ||
    filterValue === 'low_credit'
      ? filterValue
      : 'all';
  const sort: AdminUsersSortMode =
    sortValue === 'activity_recent' ||
    sortValue === 'credits_low' ||
    sortValue === 'credits_high' ||
    sortValue === 'name_az'
      ? sortValue
      : 'recent_joined';

  return {
    filters: {
      q,
      role,
      quickFilter,
      sort,
    } satisfies AdminUsersFilterState,
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    pageSize:
      Number.isFinite(pageSizeValue) && pageSizeValue >= 5 && pageSizeValue <= 100
        ? pageSizeValue
        : DEFAULT_ADMIN_USERS_PAGE_SIZE,
  };
}

type AdminUsersPageRow = {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'client';
  accountStatus: 'active' | 'suspended' | 'pending_verification' | 'banned';
  walletBalance: string;
  walletStatus: 'active' | 'locked';
  sessionCount: number;
  lastSessionAt: string;
  joinedAt: string;
  joinedAtIso: string | null;
  hasActiveSession: boolean;
  remainingSeconds: number;
  lifetimeSecondsPurchased: number;
  lifetimeSecondsUsed: number;
  lastActiveAt: string | null;
  lastActiveLabel: string;
  lowCredit: boolean;
  packageName: string | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded' | null;
  nextCreditExpiryAt: string | null;
  expiringCreditSeconds: number;
  flags: Array<{
    id: string;
    flag: string;
    color: string | null;
    createdAt: string;
  }>;
};

function sortAdminUsers(users: AdminUsersPageRow[], sort: AdminUsersSortMode) {
  return [...users].sort((left, right) => {
    if (sort === 'name_az') {
      return left.name.localeCompare(right.name);
    }

    if (sort === 'credits_low') {
      return left.remainingSeconds - right.remainingSeconds;
    }

    if (sort === 'credits_high') {
      return right.remainingSeconds - left.remainingSeconds;
    }

    if (sort === 'activity_recent') {
      return compareNullableDates(left.lastActiveAt, right.lastActiveAt);
    }

    return compareNullableDates(left.joinedAtIso, right.joinedAtIso);
  });
}

function buildAdminUsersSummary(users: AdminUsersPageRow[]): AdminUsersSummary {
  return {
    totalUsers: users.length,
    liveNow: users.filter((user) => user.hasActiveSession).length,
    lowCredits: users.filter((user) => user.lowCredit).length,
    suspended: users.filter((user) => user.accountStatus === 'suspended').length,
    adminsCount: users.filter((user) => user.role !== 'client').length,
  };
}

function filterAdminUsers(users: AdminUsersPageRow[], filters: AdminUsersFilterState) {
  const query = filters.q.trim().toLowerCase();

  return users.filter((user) => {
    if (filters.role !== 'all' && user.role !== filters.role) {
      return false;
    }

    if (filters.quickFilter === 'live' && !user.hasActiveSession) {
      return false;
    }

    if (filters.quickFilter === 'low_credit' && !user.lowCredit) {
      return false;
    }

    if (filters.quickFilter === 'suspended' && user.accountStatus !== 'suspended') {
      return false;
    }

    if (filters.quickFilter === 'banned' && user.accountStatus !== 'banned') {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query) ||
      user.flags.some((flag) => flag.flag.toLowerCase().includes(query))
    );
  });
}

function buildAdminUserRows(params: {
  users: Awaited<ReturnType<typeof listAdminUsers>>;
  wallets: Awaited<ReturnType<typeof listAdminWallets>>;
  sessions: Awaited<ReturnType<typeof listAdminSessionSummaries>>;
  flags: Awaited<ReturnType<typeof listAdminUserFlags>>;
}): AdminUsersPageRow[] {
  const walletByUserId = new Map(params.wallets.map((wallet) => [wallet.user_id, wallet]));
  const sessionsByUserId = new Map<string, typeof params.sessions>();
  const flagsByUserId = new Map<string, typeof params.flags>();

  for (const session of params.sessions) {
    const items = sessionsByUserId.get(session.user_id) ?? [];
    items.push(session);
    sessionsByUserId.set(session.user_id, items);
  }

  for (const flag of params.flags) {
    const items = flagsByUserId.get(flag.user_id) ?? [];
    items.push(flag);
    flagsByUserId.set(flag.user_id, items);
  }

  return params.users.map((user) => {
    const wallet = walletByUserId.get(user.id) ?? null;
    const userSessions = sessionsByUserId.get(user.id) ?? [];
    const userFlags = flagsByUserId.get(user.id) ?? [];
    const lastSession = userSessions[0] ?? null;
    const hasActiveSession = userSessions.some((session) => session.status === 'active');
    const lastActivityAt = lastSession ? resolveLastActivityAt(lastSession) : null;
    const remainingSeconds = wallet?.remaining_seconds ?? 0;

    return {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      accountStatus: user.account_status,
      walletBalance: formatDuration(remainingSeconds),
      walletStatus: wallet?.status ?? 'locked',
      sessionCount: userSessions.length,
      lastSessionAt: lastSession ? new Date(lastSession.start_time).toLocaleString() : 'No sessions yet',
      joinedAt: user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown',
      joinedAtIso: user.created_at ?? null,
      hasActiveSession,
      remainingSeconds,
      lifetimeSecondsPurchased: wallet?.lifetime_seconds_purchased ?? 0,
      lifetimeSecondsUsed: wallet?.lifetime_seconds_used ?? 0,
      lastActiveAt: lastActivityAt,
      lastActiveLabel: lastActivityAt ? new Date(lastActivityAt).toLocaleString() : 'No activity yet',
      lowCredit: remainingSeconds > 0 && remainingSeconds <= 30 * 60,
      packageName: null,
      paymentStatus: null,
      nextCreditExpiryAt: null,
      expiringCreditSeconds: 0,
      flags: userFlags.map((flag) => ({
        id: flag.id,
        flag: flag.flag,
        color: flag.color ?? null,
        createdAt: new Date(flag.created_at).toLocaleString(),
      })),
    };
  });
}

function buildAdminSessionRows(
  sessions: Awaited<ReturnType<typeof listAdminSessionSummaries>>,
  attempts: Awaited<ReturnType<typeof listAdminSessionAttemptSignals>>,
) {
  const attemptsBySessionId = new Map<string, typeof attempts>();

  for (const attempt of attempts) {
    if (!attempt.session_id) {
      continue;
    }

    const rows = attemptsBySessionId.get(attempt.session_id) ?? [];
    rows.push(attempt);
    attemptsBySessionId.set(attempt.session_id, rows);
  }

  return sessions.map((session) => {
    const sessionAttempts = attemptsBySessionId.get(session.id) ?? [];
    const derivedSubject = mostFrequent(sessionAttempts.map((attempt) => attempt.subjects?.name));
    const derivedCategory = mostFrequent(sessionAttempts.map((attempt) => attempt.categories?.name));
    const derivedUrl = session.page_url ?? sessionAttempts.find((attempt) => attempt.page_url)?.page_url ?? null;
    const siteDomain =
      session.page_domain ??
      extractDomainFromUrl(derivedUrl) ??
      extractDomainFromUrl(sessionAttempts.find((attempt) => attempt.page_url)?.page_url) ??
      'Unknown site';
    const pageTitle =
      session.page_title ?? sessionAttempts.find((attempt) => attempt.page_title)?.page_title ?? 'Untitled page';
    const noMatchCount = sessionAttempts.filter((attempt) => Boolean(attempt.no_match_reason)).length;

    const suspiciousFlag =
      session.status === 'failed'
        ? 'Failed session'
        : session.status === 'no_match'
          ? 'No source match'
          : session.status === 'no_credit'
            ? 'Stopped for no credit'
            : noMatchCount >= 2
              ? 'Repeated no match'
              : session.used_seconds >= 60 * 60 * 3
                ? 'Long session'
                : 'None';

    return {
      id: session.id,
      userId: session.user_id,
      userName: session.profiles?.full_name ?? 'Unknown user',
      userEmail: session.profiles?.email ?? 'No email',
      siteDomain,
      pageTitle,
      pagePath: extractPathFromUrl(derivedUrl),
      subject: session.subjects?.name ?? derivedSubject ?? 'Unassigned',
      category: session.categories?.name ?? derivedCategory,
      duration: formatDuration(session.used_seconds),
      creditsUsed: formatDuration(session.used_seconds),
      analyzeCount: sessionAttempts.length,
      startedAt: new Date(session.start_time).toLocaleString(),
      endedAt: session.end_time ? new Date(session.end_time).toLocaleString() : null,
      status: session.status,
      suspiciousFlag,
      detectionMode: session.detection_mode,
      noMatchCount,
    };
  });
}

export async function getAdminDashboardPageData() {
  const summary = await getAdminDashboardSummary();

  return {
    metrics: [
      { label: 'Total users', value: String(summary.totalUsers), delta: 'Live count', tone: 'accent' as const },
      { label: 'Sessions today', value: String(summary.sessionsToday), delta: 'Last 24 hours', tone: 'success' as const },
      { label: 'Credits sold', value: formatDurationDetailed(summary.creditsSoldSeconds), delta: 'Provisioned via purchases', tone: 'warning' as const },
      {
        label: 'Low confidence rate',
        value: formatConfidence(summary.lowConfidenceRate),
        delta: 'Across recorded attempts',
        tone: 'accent' as const,
      },
    ],
    recentActivity: summary.recentAttempts.map((attempt) =>
      `${attempt.subjects?.name ?? 'Unknown subject'} / ${attempt.categories?.name ?? 'Unassigned'} at ${new Date(attempt.created_at).toLocaleString()}`,
    ),
    sourceFailures: summary.sourceFailures,
    lowConfidenceRate: summary.lowConfidenceRate,
    mostUsedSubject:
      summary.recentAttempts
        .map((attempt) => attempt.subjects?.name)
        .find(Boolean) ?? 'No attempts yet',
  };
}

export async function getAdminSourcesPageData() {
  const [folders, sourceFiles, subjects] = await Promise.all([
    listAdminFolders(),
    listAdminSourceFiles(),
    listAdminSubjects(),
  ]);

  const activeSubjects = subjects.filter((subject) => subject.is_active);
  const activeSubjectIds = new Set(activeSubjects.map((subject) => subject.id));
  const qaPairCounts = await countAdminSubjectQaPairsBySubjectIds(activeSubjects.map((subject) => subject.id));

  return {
    folders: folders.filter((folder) => !folder.subject_id || activeSubjectIds.has(folder.subject_id)),
    sourceFiles: sourceFiles.filter((file) => activeSubjectIds.has(file.subject_id)),
    subjects: activeSubjects,
    initialQaPairs: [],
    qaPairCounts: Object.fromEntries(qaPairCounts.entries()),
    subjectsById: new Map(activeSubjects.map((subject) => [subject.id, subject])),
  };
}

export async function getAdminSubjectsPageData() {
  return listAdminSubjects();
}

export async function getAdminCategoriesPageData() {
  const [subjects, categories] = await Promise.all([listAdminSubjects(), listAdminCategories()]);
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject.name]));

  return categories.map((category) => ({
    ...category,
    subjectName: category.subject_id ? subjectsById.get(category.subject_id) ?? 'Unknown subject' : 'All subjects',
  }));
}

export async function getAdminUsersPageData(input?: {
  q?: string | string[];
  role?: string | string[];
  filter?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
}) {
  const query = normalizeAdminUsersQuery(input);
  const summaryPromise = Promise.all([
    countAdminUsers(),
    countAdminUserRollups({ quickFilter: 'live' }),
    countAdminUserRollups({ quickFilter: 'low_credit' }),
    countAdminUsers({ accountStatuses: ['suspended'] }),
    countAdminUsers({ role: 'admin' }),
    countAdminUsers({ role: 'super_admin' }),
  ]);
  const accountStatuses =
    query.filters.quickFilter === 'suspended'
      ? (['suspended'] as const)
      : query.filters.quickFilter === 'banned'
        ? (['banned'] as const)
        : undefined;
  const role = query.filters.role === 'all' ? undefined : query.filters.role;
  const totalCount = await countAdminUserRollups({
    q: query.filters.q || undefined,
    role,
    accountStatuses: accountStatuses ? [...accountStatuses] : undefined,
    quickFilter: query.filters.quickFilter,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const rollups = totalCount
    ? await listAdminUserRollups({
        q: query.filters.q || undefined,
        role,
        accountStatuses: accountStatuses ? [...accountStatuses] : undefined,
        quickFilter: query.filters.quickFilter,
        page,
        pageSize: query.pageSize,
        sort: query.filters.sort,
      })
    : [];
  const userIds = rollups.map((row) => row.user_id);
  const flags = userIds.length > 0 ? await listAdminUserFlags(undefined, userIds) : [];
  const flagsByUserId = new Map<string, typeof flags>();

  for (const flag of flags) {
    const items = flagsByUserId.get(flag.user_id) ?? [];
    items.push(flag);
    flagsByUserId.set(flag.user_id, items);
  }

  const users: AdminUsersPageRow[] = rollups.map((row) => {
    const userFlags = flagsByUserId.get(row.user_id) ?? [];

    return {
      id: row.user_id,
      name: row.full_name,
      email: row.email,
      role: row.role,
      accountStatus: row.account_status,
      walletBalance: formatDuration(row.remaining_seconds),
      walletStatus: row.wallet_status,
      sessionCount: row.session_count,
      lastSessionAt: row.last_session_at ? new Date(row.last_session_at).toLocaleString() : 'No sessions yet',
      joinedAt: row.created_at ? new Date(row.created_at).toLocaleDateString() : 'Unknown',
      joinedAtIso: row.created_at ?? null,
      hasActiveSession: row.has_active_session,
      remainingSeconds: row.remaining_seconds,
      lifetimeSecondsPurchased: row.lifetime_seconds_purchased,
      lifetimeSecondsUsed: row.lifetime_seconds_used,
      lastActiveAt: row.last_active_at ?? null,
      lastActiveLabel: row.last_active_at ? new Date(row.last_active_at).toLocaleString() : 'No activity yet',
      lowCredit: row.remaining_seconds > 0 && row.remaining_seconds <= 30 * 60,
      packageName: row.current_package_name ?? row.current_package_code ?? null,
      paymentStatus: row.last_payment_status ?? null,
      nextCreditExpiryAt: row.next_credit_expiry_at ? new Date(row.next_credit_expiry_at).toLocaleString() : null,
      expiringCreditSeconds: row.expiring_credit_seconds,
      flags: userFlags.map((flag) => ({
        id: flag.id,
        flag: flag.flag,
        color: flag.color ?? null,
        createdAt: new Date(flag.created_at).toLocaleString(),
      })),
    };
  });

  const [totalUsers, liveNowCount, lowCreditCount, suspendedCount, adminCount, superAdminCount] =
    await summaryPromise;
  const summary: AdminUsersSummary = {
    totalUsers,
    liveNow: liveNowCount,
    lowCredits: lowCreditCount,
    suspended: suspendedCount,
    adminsCount: adminCount + superAdminCount,
  };

  return {
    users,
    totalCount,
    totalPages,
    page,
    pageSize: query.pageSize,
    filters: query.filters,
    summary,
  };
}

export async function getAdminUserDetailData(userId: string) {
  const [context, transactions, payments, devices, rawSessions, auditLogs, notes, flags, accessOverride, walletGrants] = await Promise.all([
    getProfileWithWalletByUserId(userId),
    listAdminCreditTransactionsForUser(userId, 12),
    listAdminPaymentSummariesForUser(userId, 8),
    listAdminUserDevices(userId),
    listAdminSessionSummaries({ userId, limit: 8 }),
    listAdminAuditLogs(200),
    listAdminUserNotes(userId, 12),
    listAdminUserFlags(userId),
    getAdminUserAccessOverride(userId),
    listAdminWalletGrantsForUser(userId, 12),
  ]);
  const attempts = await listAdminSessionAttemptSignals(rawSessions.map((session) => session.id));
  const sessions = buildAdminSessionRows(rawSessions, attempts);
  const hasActiveSession = rawSessions.some((session) => session.status === 'active');
  const lastSession = rawSessions[0] ?? null;
  const lastActivityAt = lastSession ? resolveLastActivityAt(lastSession) : null;
  const activeDevices = devices.filter((device) => device.installation_status === 'active').length;
  const latestPayment = payments[0] ?? null;
  const nextCreditExpiryGrant =
    walletGrants
      .filter((grant) => grant.remaining_seconds > 0 && !grant.expired_at && grant.expires_at)
      .sort((left, right) => new Date(left.expires_at!).getTime() - new Date(right.expires_at!).getTime())[0] ?? null;
  const expiringCreditSeconds = walletGrants
    .filter((grant) => grant.remaining_seconds > 0 && !grant.expired_at && grant.expires_at)
    .reduce((sum, grant) => sum + grant.remaining_seconds, 0);
  const relevantAuditLogs = auditLogs
    .filter((log) => log.entity_id === userId || log.entity_id === context.wallet.id)
    .slice(0, 10)
    .map((log) => ({
      id: log.id,
      createdAt: new Date(log.created_at).toLocaleString(),
      actor: log.profiles?.full_name ?? 'System',
      actorDetail: log.profiles?.email ?? log.actor_role ?? 'system',
      event: log.event_type,
      entity: log.entity_type,
      summary: log.event_summary,
    }));

  return {
    user: {
      id: context.profile.id,
      name: context.profile.full_name,
      email: context.profile.email,
      role: context.profile.role,
      accountStatus: context.profile.account_status,
      walletBalance: formatDuration(context.wallet.remaining_seconds),
      walletStatus: context.wallet.status,
      sessionCount: rawSessions.length,
      lastSessionAt: lastSession ? new Date(lastSession.start_time).toLocaleString() : 'No sessions yet',
      joinedAt: context.profile.created_at ? new Date(context.profile.created_at).toLocaleDateString() : 'Unknown',
      joinedAtIso: context.profile.created_at ?? null,
      hasActiveSession,
      remainingSeconds: context.wallet.remaining_seconds,
      lifetimeSecondsPurchased: context.wallet.lifetime_seconds_purchased,
      lifetimeSecondsUsed: context.wallet.lifetime_seconds_used,
      lastActiveAt: lastActivityAt,
      lastActiveLabel: lastActivityAt ? new Date(lastActivityAt).toLocaleString() : 'No activity yet',
      lowCredit: context.wallet.remaining_seconds > 0 && context.wallet.remaining_seconds <= 30 * 60,
      packageName: latestPayment?.payment_packages?.name ?? latestPayment?.payment_packages?.code ?? null,
      paymentStatus: latestPayment?.status ?? null,
      nextCreditExpiryAt: nextCreditExpiryGrant?.expires_at
        ? new Date(nextCreditExpiryGrant.expires_at).toLocaleString()
        : null,
      expiringCreditSeconds,
      joinedAtFull: context.profile.created_at ? new Date(context.profile.created_at).toLocaleString() : 'Unknown',
      statusReason: context.profile.status_reason ?? null,
      suspendedUntil: context.profile.suspended_until
        ? new Date(context.profile.suspended_until).toLocaleString()
        : null,
      flags: flags.map((flag) => ({
        id: flag.id,
        flag: flag.flag,
        color: flag.color ?? null,
        createdAt: new Date(flag.created_at).toLocaleString(),
      })),
    },
    metrics: [
      {
        label: 'Credits Left',
        value: formatDuration(context.wallet.remaining_seconds),
        helper: context.wallet.status === 'locked' ? 'Wallet locked for this account' : 'Wallet ready for new sessions',
      },
      {
        label: 'Lifetime Purchased',
        value: formatDurationDetailed(context.wallet.lifetime_seconds_purchased),
        helper: 'Total credits provisioned',
      },
      {
        label: 'Lifetime Used',
        value: formatDurationDetailed(context.wallet.lifetime_seconds_used),
        helper: 'Consumed by recorded sessions',
      },
      {
        label: 'Devices',
        value: String(activeDevices),
        helper: `${devices.length} paired device${devices.length === 1 ? '' : 's'} on record`,
      },
      {
        label: 'Current Package',
        value: latestPayment?.payment_packages?.name ?? latestPayment?.payment_packages?.code ?? 'No payments yet',
        helper: latestPayment
          ? `${latestPayment.status} via ${latestPayment.provider}`
          : 'Waiting for the first successful purchase',
      },
      {
        label: 'Next Credit Expiry',
        value: nextCreditExpiryGrant?.expires_at
          ? new Date(nextCreditExpiryGrant.expires_at).toLocaleDateString()
          : 'No expiry set',
        helper:
          expiringCreditSeconds > 0
            ? `${formatDuration(expiringCreditSeconds)} will expire if unused`
            : 'All active credits are non-expiring right now',
      },
    ],
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      createdAt: new Date(transaction.created_at).toLocaleString(),
      transactionType: transaction.transaction_type,
      deltaLabel: formatSignedDuration(transaction.delta_seconds),
      balanceAfterLabel: formatDuration(transaction.balance_after_seconds),
      description: transaction.description ?? 'No description provided.',
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      createdAt: new Date(payment.created_at).toLocaleString(),
      userName: payment.profiles?.full_name ?? context.profile.full_name,
      userEmail: payment.profiles?.email ?? context.profile.email,
      provider: payment.provider,
      packageName: payment.payment_packages?.name ?? payment.payment_packages?.code ?? 'Package removed',
      amount: formatCurrency(payment.amount_minor, payment.currency),
      status: payment.status,
    })),
    sessions,
    devices: devices.map((device) => ({
      id: device.id,
      installationStatus: device.installation_status,
      deviceName: device.device_name ?? null,
      browserName: device.browser_name ?? null,
      extensionVersion: device.extension_version,
      lastSeenAt: device.last_seen_at,
    })),
    auditLogs: relevantAuditLogs,
    notes: notes.map((note) => ({
      id: note.id,
      note: note.note,
      createdAt: new Date(note.created_at).toLocaleString(),
      createdByName: note.profiles?.full_name ?? 'System',
      createdByEmail: note.profiles?.email ?? 'system',
    })),
    flags: flags.map((flag) => ({
      id: flag.id,
      flag: flag.flag,
      color: flag.color ?? null,
      createdAt: new Date(flag.created_at).toLocaleString(),
    })),
    access: {
      canUseExtension: accessOverride?.can_use_extension ?? true,
      canBuyCredits: accessOverride?.can_buy_credits ?? true,
      maxActiveDevices: accessOverride?.max_active_devices ?? null,
      dailyUsageLimitSeconds: accessOverride?.daily_usage_limit_seconds ?? null,
      monthlyUsageLimitSeconds: accessOverride?.monthly_usage_limit_seconds ?? null,
      featureFlags: extractEnabledFeatureFlags(accessOverride?.feature_flags as Record<string, unknown> | undefined),
      updatedAt: accessOverride?.updated_at ?? null,
    },
    walletGrants: walletGrants.map((grant) => ({
      id: grant.id,
      totalLabel: formatDuration(grant.total_seconds),
      remainingLabel: formatDuration(grant.remaining_seconds),
      expiresAt: grant.expires_at ? new Date(grant.expires_at).toLocaleString() : null,
      status: (grant.expired_at ? 'expired' : grant.remaining_seconds === 0 ? 'depleted' : 'active') as
        | 'active'
        | 'expired'
        | 'depleted',
      description: grant.description,
    })),
  };
}

export async function getAdminPaymentsPageData() {
  const [payments, packages, totalCount, paidCount, pendingCount, failedCount, canceledCount, refundedCount] = await Promise.all([
    listAdminPaymentSummaries({ pageSize: 100 }),
    listAdminPaymentPackages(),
    countAdminPaymentSummaries(),
    countAdminPaymentSummaries({ status: 'paid' }),
    countAdminPaymentSummaries({ status: 'pending' }),
    countAdminPaymentSummaries({ status: 'failed' }),
    countAdminPaymentSummaries({ status: 'canceled' }),
    countAdminPaymentSummaries({ status: 'refunded' }),
  ]);
  const paidPayments = payments.filter((payment) => payment.status === 'paid');
  const defaultCurrency = paidPayments[0]?.currency ?? packages[0]?.currency ?? 'PHP';

  return {
    metrics: [
      {
        label: 'Total payments',
        value: String(totalCount),
        delta: 'All-time payment records',
        tone: 'accent' as const,
      },
      {
        label: 'Gross revenue',
        value: formatCurrency(
          paidPayments.reduce((sum, payment) => sum + payment.amount_minor, 0),
          defaultCurrency,
        ),
        delta: 'Paid transactions only',
        tone: 'success' as const,
      },
      {
        label: 'Pending',
        value: String(pendingCount),
        delta: 'Awaiting payment confirmation',
        tone: 'warning' as const,
      },
      {
        label: 'Successful',
        value: String(paidCount),
        delta: 'Completed and credited',
        tone: 'success' as const,
      },
    ],
    statusCounts: {
      total: totalCount,
      paid: paidCount,
      pending: pendingCount,
      failed: failedCount,
      canceled: canceledCount,
      refunded: refundedCount,
    },
    packages: packages.map((paymentPackage) => ({
      id: paymentPackage.id,
      code: paymentPackage.code,
      name: paymentPackage.name,
      description: paymentPackage.description,
      minutesToCredit: Math.round(paymentPackage.seconds_to_credit / 60),
      amountMinor: paymentPackage.amount_minor,
      amountDisplay: (paymentPackage.amount_minor / 100).toFixed(2),
      currency: paymentPackage.currency,
      isActive: paymentPackage.is_active,
      sortOrder: paymentPackage.sort_order,
      creditExpiresAfterDays: paymentPackage.credit_expires_after_days ?? null,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      userId: payment.user_id,
      createdAt: new Date(payment.created_at).toLocaleString(),
      createdAtIso: payment.created_at,
      paidAt: payment.paid_at ? new Date(payment.paid_at).toLocaleString() : null,
      paidAtIso: payment.paid_at,
      userName: payment.profiles?.full_name ?? 'Unknown user',
      userEmail: payment.profiles?.email ?? 'No email',
      provider: payment.provider,
      providerPaymentId: payment.provider_payment_id,
      packageName: payment.payment_packages?.name ?? payment.payment_packages?.code ?? 'Package removed',
      packageCode: payment.payment_packages?.code ?? null,
      amountMinor: payment.amount_minor,
      currency: payment.currency,
      amount: formatCurrency(payment.amount_minor, payment.currency),
      status: payment.status,
      paymentType: payment.payment_type,
    })),
  };
}

export async function getAdminSessionsPageData(options?: { userId?: string; limit?: number }) {
  const sessions = await listAdminSessionSummaries({ userId: options?.userId, limit: options?.limit ?? 100 });
  const attempts = await listAdminSessionAttemptSignals(sessions.map((session) => session.id));
  return buildAdminSessionRows(sessions, attempts);
}

export async function getAdminSessionsOverviewPageData() {
  const [users, sessions, rawSessions] = await Promise.all([
    listAdminUsers(),
    getAdminSessionsPageData({ limit: 150 }),
    listAdminSessionSummaries({ limit: 150 }),
  ]);

  const sessionUserIds = new Set(sessions.map((session) => session.userId));
  const usersWithoutSessions = users
    .filter((user) => user.role === 'client' && !sessionUserIds.has(user.id))
    .map((user) => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      joinedAt: user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown',
    }));

  const uniqueUsers = new Set(sessions.map((session) => session.userId));
  const activeCount = sessions.filter((session) => session.status === 'active').length;
  const billedSeconds = rawSessions.reduce((sum, session) => sum + session.used_seconds, 0);

  return {
    metrics: [
      { label: 'Live sessions', value: String(activeCount), delta: 'Currently active clients', tone: 'success' as const },
      { label: 'Clients with sessions', value: String(uniqueUsers.size), delta: 'Users who already consumed credits', tone: 'accent' as const },
      { label: 'Clients with no sessions', value: String(usersWithoutSessions.length), delta: 'Registered but not yet started', tone: 'warning' as const },
      { label: 'Recent billed time', value: formatDuration(billedSeconds), delta: 'Across loaded session history', tone: 'accent' as const },
    ],
    sessions,
    usersWithoutSessions,
    lastRefreshedAt: new Date().toLocaleTimeString(),
  };
}

export async function getAdminUserSessionsPageData(userId: string) {
  const [context, sessions] = await Promise.all([
    getProfileWithWalletByUserId(userId),
    listAdminSessionSummaries({ userId }),
  ]);
  const attempts = await listAdminSessionAttemptSignals(sessions.map((session) => session.id));
  const rows = buildAdminSessionRows(sessions, attempts);
  const totalAnalyzes = rows.reduce((sum, row) => sum + row.analyzeCount, 0);
  const totalCreditsUsedSeconds = sessions.reduce((sum, session) => sum + session.used_seconds, 0);
  const topSite = mostFrequent(rows.map((row) => row.siteDomain)) ?? 'No site yet';
  const topSubject = mostFrequent(rows.map((row) => row.subject)) ?? 'No subject yet';
  const activeSessions = rows.filter((row) => row.status === 'active').length;

  return {
    user: {
      id: context.profile.id,
      name: context.profile.full_name,
      email: context.profile.email,
      role: context.profile.role,
      accountStatus: context.profile.account_status,
      walletBalance: formatDuration(context.wallet.remaining_seconds),
      walletStatus: context.wallet.status,
    },
    metrics: [
      { label: 'Sessions', value: String(rows.length), delta: 'Billed usage windows', tone: 'accent' as const },
      {
        label: 'Credits used',
        value: formatDuration(totalCreditsUsedSeconds),
        delta: 'Time consumed from wallet',
        tone: 'warning' as const,
      },
      {
        label: 'Analyze attempts',
        value: String(totalAnalyzes),
        delta: 'Question scans inside sessions',
        tone: 'success' as const,
      },
      {
        label: 'Active sessions',
        value: String(activeSessions),
        delta: `Top site: ${topSite}`,
        tone: 'accent' as const,
      },
    ],
    summary: {
      topSite,
      topSubject,
      uniqueSites: new Set(rows.map((row) => row.siteDomain)).size,
      uniqueSubjects: new Set(rows.map((row) => row.subject).filter((item) => item !== 'Unassigned')).size,
    },
    sessions: rows,
  };
}

export async function getAdminSessionDetailPageData(sessionId: string) {
  const [session, attempts, creditTransactions] = await Promise.all([
    getAdminSessionDetail(sessionId),
    listAdminQuestionAttemptsForSession(sessionId),
    listAdminCreditTransactionsForSession(sessionId),
  ]);
  const { profile, wallet } = await getProfileWithWalletByUserId(session.user_id);

  const pageHistory = new Map<string, { title: string; firstSeenAt: string; hits: number }>();
  const subjectHistory: Array<{ id: string; createdAt: string; subject: string; category: string | null }> = [];

  for (const attempt of attempts) {
    const key = attempt.page_url ?? `unknown:${attempt.id}`;
    const existing = pageHistory.get(key);

    if (existing) {
      existing.hits += 1;
    } else {
      pageHistory.set(key, {
        title: attempt.page_title ?? 'Untitled page',
        firstSeenAt: new Date(attempt.created_at).toLocaleString(),
        hits: 1,
      });
    }

    subjectHistory.push({
      id: attempt.id,
      createdAt: new Date(attempt.created_at).toLocaleString(),
      subject: attempt.subjects?.name ?? 'Unassigned',
      category: attempt.categories?.name ?? null,
    });
  }

  return {
    session: {
      id: session.id,
      userId: session.user_id,
      userName: profile.full_name,
      userEmail: profile.email,
      siteDomain: session.page_domain ?? extractDomainFromUrl(session.page_url) ?? 'Unknown site',
      pageTitle: session.page_title ?? 'Untitled page',
      pagePath: extractPathFromUrl(session.page_url),
      subject: session.subjects?.name ?? mostFrequent(subjectHistory.map((item) => item.subject)) ?? 'Unassigned',
      category: session.categories?.name ?? mostFrequent(subjectHistory.map((item) => item.category ?? undefined)),
      duration: formatDuration(session.used_seconds),
      creditsUsed: formatDuration(session.used_seconds),
      analyzeCount: attempts.length,
      startedAt: new Date(session.start_time).toLocaleString(),
      endedAt: session.end_time ? new Date(session.end_time).toLocaleString() : null,
      status: session.status,
      suspiciousFlag:
        session.status === 'failed'
          ? 'Failed session'
          : session.status === 'no_match'
            ? 'No source match'
            : creditTransactions.length === 0 && attempts.length > 0
              ? 'No debit recorded yet'
              : 'None',
      detectionMode: session.detection_mode,
      noMatchCount: attempts.filter((attempt) => Boolean(attempt.no_match_reason)).length,
    },
    user: {
      id: profile.id,
      name: profile.full_name,
      email: profile.email,
      accountStatus: profile.account_status,
      walletBalance: formatDuration(wallet.remaining_seconds),
    },
    pageHistory: Array.from(pageHistory.entries()).map(([url, item]) => ({
      url,
      title: item.title,
      firstSeenAt: item.firstSeenAt,
      hits: item.hits,
    })),
    subjectHistory,
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      createdAt: new Date(attempt.created_at).toLocaleString(),
      pageTitle: attempt.page_title ?? 'Untitled page',
      pageUrl: attempt.page_url ?? 'No URL stored',
      subject: attempt.subjects?.name ?? 'Unassigned',
      category: attempt.categories?.name ?? null,
      confidence: formatConfidence(attempt.final_confidence ?? 0),
      noMatchReason: attempt.no_match_reason,
      answerPreview: attempt.answer_text ?? null,
    })),
    debitTimeline: creditTransactions.map((entry) => ({
      id: entry.id,
      createdAt: new Date(entry.created_at).toLocaleString(),
      transactionType: entry.transaction_type,
      delta: formatDuration(Math.abs(entry.delta_seconds)),
      direction: entry.delta_seconds < 0 ? 'debit' : 'credit',
      balanceAfter: formatDuration(entry.balance_after_seconds),
      description: entry.description ?? 'No description',
    })),
  };
}

export async function getAdminReportsPageData() {
  const [summary, payments, sessions] = await Promise.all([
    getAdminDashboardSummary(),
    listAdminPaymentSummaries(),
    listAdminSessionSummaries(),
  ]);

  const paidPayments = payments.filter((payment) => payment.status === 'paid');
  const activeSessions = sessions.filter((session) => session.status === 'active').length;
  const noMatchSessions = sessions.filter((session) => session.status === 'no_match').length;
  const topSubjects = new Map<string, number>();

  for (const attempt of summary.recentAttempts) {
    const key = attempt.subjects?.name ?? 'Unassigned';
    topSubjects.set(key, (topSubjects.get(key) ?? 0) + 1);
  }

  return {
    metrics: [
      { label: 'Revenue', value: formatCurrency(paidPayments.reduce((sum, row) => sum + row.amount_minor, 0), paidPayments[0]?.currency ?? 'USD'), delta: 'Latest 50 payments', tone: 'accent' as const },
      { label: 'Active sessions', value: String(activeSessions), delta: 'Current sample window', tone: 'success' as const },
      { label: 'No match sessions', value: String(noMatchSessions), delta: 'Needs source coverage', tone: 'warning' as const },
      { label: 'Low confidence', value: formatConfidence(summary.lowConfidenceRate), delta: confidenceToLevel(summary.lowConfidenceRate), tone: 'warning' as const },
    ],
    usageHighlights: [
      `Sessions today: ${summary.sessionsToday}`,
      `Credits sold: ${formatDurationDetailed(summary.creditsSoldSeconds)}`,
      `Source processing failures: ${summary.sourceFailures}`,
      `Most recent subject trend: ${
        Array.from(topSubjects.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'No data yet'
      }`,
    ],
    paymentHighlights: [
      `Paid payments: ${paidPayments.length}`,
      `Pending payments: ${payments.filter((payment) => payment.status === 'pending').length}`,
      `Failed payments: ${payments.filter((payment) => payment.status === 'failed').length}`,
      `Refunded payments: ${payments.filter((payment) => payment.status === 'refunded').length}`,
    ],
    recentFindings: summary.recentAttempts.map((attempt) => ({
      id: attempt.id,
      subject: attempt.subjects?.name ?? 'Unknown subject',
      category: attempt.categories?.name ?? 'Unassigned',
      confidence: formatConfidence(attempt.final_confidence ?? 0),
      createdAt: new Date(attempt.created_at).toLocaleString(),
      noMatchReason: attempt.no_match_reason ?? 'Matched',
    })),
  };
}

export async function getAdminAuditLogsPageData() {
  const logs = await listAdminAuditLogs(50);

  return logs.map((log) => ({
    id: log.id,
    createdAt: new Date(log.created_at).toLocaleString(),
    actor: log.profiles?.full_name ?? log.actor_role ?? 'System',
    actorDetail: log.profiles?.email ?? 'Server-side action',
    event: log.event_type,
    entity: `${log.entity_type}${log.entity_id ? `:${log.entity_id}` : ''}`,
    summary: log.event_summary,
  }));
}

export function buildFolderTree(folderRows: Awaited<ReturnType<typeof getAdminSourcesPageData>>['folders']) {
  const byParent = new Map<string | null, typeof folderRows>();

  for (const folder of folderRows) {
    const key = folder.parent_id ?? null;
    const list = byParent.get(key) ?? [];
    list.push(folder);
    byParent.set(key, list);
  }

  function build(parentId: string | null): Array<(typeof folderRows)[number] & { children: ReturnType<typeof build> }> {
    return (byParent.get(parentId) ?? []).map((folder) => ({
      ...folder,
      children: build(folder.id),
    }));
  }

  return build(null);
}

export function formatAdminSourceStatus(status: string) {
  return status;
}

export function formatPaymentAmount(amountMinor: number, currency: string) {
  return formatCurrency(amountMinor, currency);
}

export function formatSessionUsage(seconds: number) {
  return formatDuration(seconds);
}
