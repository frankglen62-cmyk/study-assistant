import 'server-only';

import {
  confidenceToLevel,
  formatConfidence,
  formatCurrency,
  formatDuration,
  formatDurationDetailed,
} from '@study-assistant/shared-utils';

import {
  getAdminDashboardSummary,
  getAdminSessionDetail,
  listAdminAuditLogs,
  listAdminCategories,
  listAdminCreditTransactionsForSession,
  listAdminFolders,
  listAdminPaymentSummaries,
  listAdminQuestionAttemptsForSession,
  listAdminSessionAttemptSignals,
  listAdminSessionSummaries,
  listAdminSourceFiles,
  listAdminSubjects,
  listAdminUsers,
  listAdminWallets,
} from '@/lib/supabase/admin';
import { countAdminSubjectQaPairsBySubjectIds, listAdminSubjectQaPairsBySubjectId } from '@/lib/supabase/subject-qa';
import { getProfileWithWalletByUserId } from '@/lib/supabase/users';

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
  const initialSubjectId = activeSubjects[0]?.id ?? null;
  const [qaPairCounts, initialQaPairs] = await Promise.all([
    countAdminSubjectQaPairsBySubjectIds(activeSubjects.map((subject) => subject.id)),
    initialSubjectId ? listAdminSubjectQaPairsBySubjectId(initialSubjectId) : Promise.resolve([]),
  ]);

  return {
    folders: folders.filter((folder) => !folder.subject_id || activeSubjectIds.has(folder.subject_id)),
    sourceFiles: sourceFiles.filter((file) => activeSubjectIds.has(file.subject_id)),
    subjects: activeSubjects,
    initialQaPairs: initialQaPairs.filter((pair) => activeSubjectIds.has(pair.subject_id)),
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

export async function getAdminUsersPageData() {
  const [users, wallets, sessions] = await Promise.all([
    listAdminUsers(),
    listAdminWallets(),
    listAdminSessionSummaries({ limit: 250 }),
  ]);

  const walletByUserId = new Map(wallets.map((wallet) => [wallet.user_id, wallet]));
  const sessionsByUserId = new Map<string, typeof sessions>();

  for (const session of sessions) {
    const items = sessionsByUserId.get(session.user_id) ?? [];
    items.push(session);
    sessionsByUserId.set(session.user_id, items);
  }

  return users.map((user) => {
    const wallet = walletByUserId.get(user.id) ?? null;
    const userSessions = sessionsByUserId.get(user.id) ?? [];
    const lastSession = userSessions[0] ?? null;

    return {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      accountStatus: user.account_status,
      walletBalance: wallet ? formatDuration(wallet.remaining_seconds) : '0m',
      walletStatus: wallet?.status ?? 'locked',
      sessionCount: userSessions.length,
      lastSessionAt: lastSession ? new Date(lastSession.start_time).toLocaleString() : 'No sessions yet',
      joinedAt: user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown',
    };
  });
}

export async function getAdminPaymentsPageData() {
  const payments = await listAdminPaymentSummaries();
  const paidPayments = payments.filter((payment) => payment.status === 'paid');
  const refundedPayments = payments.filter((payment) => payment.status === 'refunded');
  const failedPayments = payments.filter((payment) => payment.status === 'failed');

  return {
    metrics: [
      {
        label: 'Successful payments',
        value: String(paidPayments.length),
        delta: 'Latest 50 records',
        tone: 'success' as const,
      },
      {
        label: 'Gross revenue',
        value: formatCurrency(
          paidPayments.reduce((sum, payment) => sum + payment.amount_minor, 0),
          paidPayments[0]?.currency ?? 'USD',
        ),
        delta: 'Paid transactions only',
        tone: 'accent' as const,
      },
      {
        label: 'Refunded',
        value: String(refundedPayments.length),
        delta: 'Requires follow-up',
        tone: 'warning' as const,
      },
      {
        label: 'Failed',
        value: String(failedPayments.length),
        delta: 'Check provider logs',
        tone: 'warning' as const,
      },
    ],
    payments: payments.map((payment) => ({
      id: payment.id,
      createdAt: new Date(payment.created_at).toLocaleString(),
      userName: payment.profiles?.full_name ?? 'Unknown user',
      userEmail: payment.profiles?.email ?? 'No email',
      provider: payment.provider,
      packageName: payment.payment_packages?.name ?? payment.payment_packages?.code ?? 'Package removed',
      amount: formatCurrency(payment.amount_minor, payment.currency),
      status: payment.status,
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
