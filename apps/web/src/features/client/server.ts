import 'server-only';

import { formatCurrency, formatDuration } from '@study-assistant/shared-utils';

import { getClientSettingsByUserId } from '@/lib/supabase/client-settings';
import { listRecentQuestionAttempts } from '@/lib/supabase/admin';
import { listInstallationsForUser } from '@/lib/supabase/extension';
import { getBillingProviderAvailability } from '@/lib/payments/service';
import { listPaymentsForUser, listActivePaymentPackages } from '@/lib/supabase/payments';
import { listSessionsForUser, getOpenSessionForUser } from '@/lib/supabase/sessions';

export async function getClientDashboardData(userId: string) {
  const [sessions, recentAttempts, devices] = await Promise.all([
    listSessionsForUser(userId, 7),
    listRecentQuestionAttempts(userId, 5),
    listInstallationsForUser(userId),
  ]);

  const activeSession = sessions.find((session) => session.status === 'active') ?? null;
  const latestAttempt = recentAttempts[0] ?? null;
  const usedThisWeek = sessions.reduce((sum, session) => sum + session.used_seconds, 0);

  return {
    usedThisWeek,
    sessionStatus: activeSession?.status ?? 'ended',
    lastDetectedSubject: latestAttempt?.subjects?.name ?? 'No subject yet',
    lastUsedCategory: latestAttempt?.categories?.name ?? 'No category yet',
    recentActions: [
      `Manage ${devices.length} paired device${devices.length === 1 ? '' : 's'}`,
      'Buy Credits',
      'Open Extension Guide',
      'View Usage Logs',
    ],
  };
}

export async function getClientSessionsTableData(userId: string) {
  const [sessions, attempts] = await Promise.all([listSessionsForUser(userId, 20), listRecentQuestionAttempts(userId, 40)]);

  return sessions.map((session) => {
    const matchedAttempt = attempts.find((attempt) => attempt.created_at >= session.start_time && (!session.end_time || attempt.created_at <= session.end_time));

    return {
      id: session.id,
      date: new Date(session.start_time).toLocaleString(),
      duration: formatDuration(session.used_seconds),
      subject: matchedAttempt?.subjects?.name ?? 'Unassigned',
      category: matchedAttempt?.categories?.name ?? 'Unassigned',
      creditsUsed: formatDuration(session.used_seconds),
      status: session.status,
    };
  });
}

export async function getClientBillingData(userId: string) {
  const [packages, payments] = await Promise.all([listActivePaymentPackages(), listPaymentsForUser(userId)]);
  const providerAvailability = getBillingProviderAvailability();

  return {
    providerAvailability,
    packages: packages.map((entry, index) => ({
      id: entry.id,
      name: entry.name,
      price: formatCurrency(entry.amount_minor, entry.currency),
      description: entry.description,
      featured: index === 1,
      supportsStripe: providerAvailability.stripe,
      supportsPaymongo: providerAvailability.paymongo,
      currency: entry.currency,
    })),
    paymentHistory: payments.map((payment) => ({
      id: payment.id,
      date: new Date(payment.created_at).toLocaleDateString(),
      package: payment.payment_packages?.name ?? payment.payment_packages?.code ?? 'Package removed',
      provider: payment.provider,
      amount: formatCurrency(payment.amount_minor, payment.currency),
      status: payment.status,
    })),
  };
}

export async function getClientAccountData(userId: string) {
  const [payments, devices] = await Promise.all([listPaymentsForUser(userId), listInstallationsForUser(userId)]);

  return {
    devices: devices.map((device) => ({
      id: device.id,
      name: `${device.browser_name ?? 'Browser'} on ${device.device_name ?? 'Unnamed device'}`,
      version: device.extension_version ?? 'Unknown version',
      lastSeen: device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never',
      status: device.installation_status,
    })),
    paymentHistory: payments.map((payment) => ({
      id: payment.id,
      date: new Date(payment.created_at).toLocaleDateString(),
      package: payment.payment_packages?.name ?? payment.payment_packages?.code ?? 'Package removed',
      provider: payment.provider,
      amount: formatCurrency(payment.amount_minor, payment.currency),
      status: payment.status,
    })),
  };
}

export async function getClientPortalOverview(userId: string) {
  const [openSession, sessions] = await Promise.all([getOpenSessionForUser(userId), listSessionsForUser(userId, 10)]);

  return {
    openSession,
    sessionsCount: sessions.length,
  };
}

export async function getClientSettingsData(userId: string) {
  return getClientSettingsByUserId(userId);
}
