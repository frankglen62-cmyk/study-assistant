import { z } from 'zod';

import { RouteError } from '@/lib/http/route';

import {
  categoryRecordSchema,
  folderRecordSchema,
  installationRecordSchema,
  paymentPackageSchema,
  paymentRecordSchema,
  profileRecordSchema,
  questionAttemptSummarySchema,
  sessionRecordSchema,
  sourceFileRecordSchema,
  subjectRecordSchema,
  userAccessOverrideRecordSchema,
  userAdminNoteRecordSchema,
  userFlagRecordSchema,
  walletGrantRecordSchema,
  walletRecordSchema,
  type CategoryRecord,
  type FolderRecord,
  type InstallationRecord,
  type PaymentPackageRecord,
  type PaymentRecord,
  type ProfileRecord,
  type QuestionAttemptSummaryRecord,
  type SessionRecord,
  type SourceFileRecord,
  type SubjectRecord,
  type UserAccessOverrideRecord,
  type UserAdminNoteRecord,
  type UserFlagRecord,
  type WalletGrantRecord,
  type WalletRecord,
} from './schemas';
import { getSupabaseAdmin } from './server';
import { assertSupabaseResult, parseArray } from './utils';

function escapeIlikePattern(value: string) {
  return value.replace(/[%_,]/g, (char) => `\\${char}`);
}

const adminPaymentSummarySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: z.enum(['stripe', 'paymongo']),
  provider_payment_id: z.string(),
  amount_minor: z.number().int().nonnegative(),
  currency: z.string(),
  status: z.enum(['pending', 'paid', 'failed', 'canceled', 'refunded']),
  payment_type: z.enum(['topup', 'subscription']),
  created_at: z.string(),
  paid_at: z.string().nullable(),
  payment_packages: z
    .object({
      code: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  profiles: z
    .object({
      full_name: z.string(),
      email: z.string().email(),
    })
    .nullable()
    .optional(),
});

const adminPaymentPackageSchema = paymentPackageSchema.extend({
  sort_order: z.number().int(),
});

const adminUserRollupSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string(),
  email: z.string().email(),
  role: z.enum(['super_admin', 'admin', 'client']),
  account_status: z.enum(['active', 'suspended', 'pending_verification', 'banned']),
  created_at: z.string(),
  status_reason: z.string().nullable().optional(),
  suspended_until: z.string().nullable().optional(),
  wallet_status: z.enum(['active', 'locked']),
  remaining_seconds: z.number().int().nonnegative(),
  lifetime_seconds_purchased: z.number().int().nonnegative(),
  lifetime_seconds_used: z.number().int().nonnegative(),
  session_count: z.number().int().nonnegative(),
  has_active_session: z.boolean(),
  last_active_at: z.string().nullable().optional(),
  last_session_at: z.string().nullable().optional(),
  current_package_name: z.string().nullable().optional(),
  current_package_code: z.string().nullable().optional(),
  last_payment_status: z.enum(['pending', 'paid', 'failed', 'canceled', 'refunded']).nullable().optional(),
  last_payment_at: z.string().nullable().optional(),
  next_credit_expiry_at: z.string().nullable().optional(),
  expiring_credit_seconds: z.number().int().nonnegative(),
  flag_labels: z.array(z.string()).default([]),
  flags_text: z.string().default(''),
});

const adminSessionSummarySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(['active', 'paused', 'ended', 'timed_out', 'no_credit', 'no_match', 'failed']),
  detection_mode: z.enum(['auto', 'manual']),
  current_subject_id: z.string().uuid().nullable(),
  current_category_id: z.string().uuid().nullable(),
  used_seconds: z.number().int().nonnegative(),
  start_time: z.string(),
  end_time: z.string().nullable(),
  last_activity_at: z.string().nullable().optional(),
  page_url: z.string().nullable().optional(),
  page_domain: z.string().nullable().optional(),
  page_title: z.string().nullable().optional(),
  profiles: z
    .object({
      full_name: z.string(),
      email: z.string().email(),
    })
    .nullable()
    .optional(),
  subjects: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
  categories: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
});

const adminSessionAttemptSignalSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  page_url: z.string().nullable().optional(),
  page_title: z.string().nullable().optional(),
  no_match_reason: z.string().nullable().optional(),
  subjects: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
  categories: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
});

const adminAuditLogSchema = z.object({
  id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable().optional(),
  actor_role: z.enum(['super_admin', 'admin', 'client']).nullable().optional(),
  event_type: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable().optional(),
  event_summary: z.string(),
  created_at: z.string(),
  profiles: z
    .object({
      full_name: z.string(),
      email: z.string().email(),
    })
    .nullable()
    .optional(),
});

const adminSessionDetailSchema = adminSessionSummarySchema.extend({
  extension_installation_id: z.string().uuid().nullable().optional(),
  last_activity_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const adminCreditTransactionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  wallet_id: z.string().uuid(),
  transaction_type: z.enum([
    'purchase',
    'usage_debit',
    'admin_adjustment_add',
    'admin_adjustment_subtract',
    'refund',
    'promo',
    'expiration',
    'restoration',
  ]),
  delta_seconds: z.number().int(),
  balance_after_seconds: z.number().int(),
  related_payment_id: z.string().uuid().nullable().optional(),
  related_session_id: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string(),
});

export type AdminPaymentSummaryRecord = z.infer<typeof adminPaymentSummarySchema>;
export type AdminPaymentPackageRecord = z.infer<typeof adminPaymentPackageSchema>;
export type AdminUserRollupRecord = z.infer<typeof adminUserRollupSchema>;
export type AdminSessionSummaryRecord = z.infer<typeof adminSessionSummarySchema>;
export type AdminSessionAttemptSignalRecord = z.infer<typeof adminSessionAttemptSignalSchema>;
export type AdminAuditLogRecord = z.infer<typeof adminAuditLogSchema>;
export type AdminSessionDetailRecord = z.infer<typeof adminSessionDetailSchema>;
export type AdminCreditTransactionRecord = z.infer<typeof adminCreditTransactionSchema>;
export type AdminUserNoteRecord = UserAdminNoteRecord;
export type AdminUserFlagRecord = UserFlagRecord;
export type AdminUserAccessOverrideAdminRecord = UserAccessOverrideRecord;

export async function listAdminSubjects(): Promise<SubjectRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, slug, course_code, department, description, keywords, url_patterns, is_active')
    .order('name', { ascending: true });

  assertSupabaseResult(error, 'Failed to load subjects.');
  return parseArray(data ?? [], subjectRecordSchema, 'Subject rows are invalid.');
}

export async function listAdminCategories(): Promise<CategoryRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('categories')
    .select('id, subject_id, name, slug, default_keywords, is_active')
    .order('sort_order', { ascending: true });

  assertSupabaseResult(error, 'Failed to load categories.');
  return parseArray(data ?? [], categoryRecordSchema, 'Category rows are invalid.');
}

export async function listAdminFolders(): Promise<FolderRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('folders')
    .select('id, parent_id, subject_id, folder_type, name, slug, sort_order, is_active, archived_at, deleted_at')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  assertSupabaseResult(error, 'Failed to load folders.');
  return parseArray(data ?? [], folderRecordSchema, 'Folder rows are invalid.');
}

export async function listAdminSourceFiles(): Promise<SourceFileRecord[]> {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const rows: unknown[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('source_files')
      .select(`
        id,
        folder_id,
        subject_id,
        category_id,
        title,
        source_status,
        version_number,
        processing_error,
        source_priority,
        created_at,
        updated_at,
        activated_at,
        profiles:uploaded_by (
          full_name
        ),
        subjects:subject_id (
          name
        ),
        categories:category_id (
          name
        )
      `)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    assertSupabaseResult(error, 'Failed to load source files.');

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return parseArray(rows, sourceFileRecordSchema, 'Source file rows are invalid.');
}

export async function listAdminUsers(options?: {
  userIds?: string[];
  role?: 'client' | 'admin' | 'super_admin';
  accountStatuses?: Array<'active' | 'suspended' | 'pending_verification' | 'banned'>;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: 'created_desc' | 'name_asc';
}): Promise<ProfileRecord[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('profiles')
    .select('id, email, full_name, role, account_status, email_2fa_enabled, status_reason, status_changed_at, status_changed_by, suspended_until, created_at');

  if (options?.userIds && options.userIds.length > 0) {
    query = query.in('id', options.userIds);
  }

  if (options?.role) {
    query = query.eq('role', options.role);
  }

  if (options?.accountStatuses && options.accountStatuses.length > 0) {
    query = query.in('account_status', options.accountStatuses);
  }

  if (options?.search?.trim()) {
    const escaped = escapeIlikePattern(options.search.trim());
    query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  query =
    options?.sort === 'name_asc'
      ? query.order('full_name', { ascending: true }).order('created_at', { ascending: false })
      : query.order('created_at', { ascending: false });

  if (typeof options?.page === 'number' && typeof options?.pageSize === 'number') {
    const start = Math.max(0, (options.page - 1) * options.pageSize);
    query = query.range(start, start + options.pageSize - 1);
  }

  const { data, error } = await query;

  assertSupabaseResult(error, 'Failed to load users.');
  return parseArray(data ?? [], profileRecordSchema, 'User rows are invalid.');
}

export async function countAdminUsers(options?: {
  role?: 'client' | 'admin' | 'super_admin';
  accountStatuses?: Array<'active' | 'suspended' | 'pending_verification' | 'banned'>;
  search?: string;
  userIds?: string[];
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('profiles').select('*', { head: true, count: 'exact' });

  if (options?.userIds && options.userIds.length > 0) {
    query = query.in('id', options.userIds);
  }

  if (options?.role) {
    query = query.eq('role', options.role);
  }

  if (options?.accountStatuses && options.accountStatuses.length > 0) {
    query = query.in('account_status', options.accountStatuses);
  }

  if (options?.search?.trim()) {
    const escaped = escapeIlikePattern(options.search.trim());
    query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { count, error } = await query;
  assertSupabaseResult(error, 'Failed to count users.');
  return count ?? 0;
}

function applyAdminUserRollupFilters(
  query: any,
  options?: {
    q?: string;
    role?: 'client' | 'admin' | 'super_admin';
    accountStatuses?: Array<'active' | 'suspended' | 'pending_verification' | 'banned'>;
    quickFilter?: 'all' | 'live' | 'suspended' | 'banned' | 'low_credit';
  },
) {
  let nextQuery = query;

  if (options?.role) {
    nextQuery = nextQuery.eq('role', options.role);
  }

  if (options?.accountStatuses && options.accountStatuses.length > 0) {
    nextQuery = nextQuery.in('account_status', options.accountStatuses);
  }

  if (options?.quickFilter === 'live') {
    nextQuery = nextQuery.eq('has_active_session', true);
  }

  if (options?.quickFilter === 'low_credit') {
    nextQuery = nextQuery.gt('remaining_seconds', 0).lte('remaining_seconds', 30 * 60);
  }

  if (options?.quickFilter === 'suspended') {
    nextQuery = nextQuery.eq('account_status', 'suspended');
  }

  if (options?.quickFilter === 'banned') {
    nextQuery = nextQuery.eq('account_status', 'banned');
  }

  if (options?.q?.trim()) {
    const escaped = escapeIlikePattern(options.q.trim());
    nextQuery = nextQuery.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,flags_text.ilike.%${escaped}%`);
  }

  return nextQuery;
}

export async function listAdminUserRollups(options?: {
  q?: string;
  role?: 'client' | 'admin' | 'super_admin';
  accountStatuses?: Array<'active' | 'suspended' | 'pending_verification' | 'banned'>;
  quickFilter?: 'all' | 'live' | 'suspended' | 'banned' | 'low_credit';
  page?: number;
  pageSize?: number;
  sort?: 'recent_joined' | 'name_az' | 'credits_low' | 'credits_high' | 'activity_recent';
}): Promise<AdminUserRollupRecord[]> {
  const supabase = getSupabaseAdmin();
  let query = applyAdminUserRollupFilters(
    supabase
      .from('admin_user_rollups')
      .select(`
        user_id,
        full_name,
        email,
        role,
        account_status,
        created_at,
        status_reason,
        suspended_until,
        wallet_status,
        remaining_seconds,
        lifetime_seconds_purchased,
        lifetime_seconds_used,
        session_count,
        has_active_session,
        last_active_at,
        last_session_at,
        current_package_name,
        current_package_code,
        last_payment_status,
        last_payment_at,
        next_credit_expiry_at,
        expiring_credit_seconds,
        flag_labels,
        flags_text
      `),
    options,
  );

  if (options?.sort === 'name_az') {
    query = query.order('full_name', { ascending: true }).order('created_at', { ascending: false });
  } else if (options?.sort === 'credits_low') {
    query = query.order('remaining_seconds', { ascending: true }).order('created_at', { ascending: false });
  } else if (options?.sort === 'credits_high') {
    query = query.order('remaining_seconds', { ascending: false }).order('created_at', { ascending: false });
  } else if (options?.sort === 'activity_recent') {
    query = query.order('last_active_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (typeof options?.page === 'number' && typeof options?.pageSize === 'number') {
    const start = Math.max(0, (options.page - 1) * options.pageSize);
    query = query.range(start, start + options.pageSize - 1);
  }

  const { data, error } = await query;
  assertSupabaseResult(error, 'Failed to load admin user rollups.');
  return parseArray(data ?? [], adminUserRollupSchema, 'Admin user rollup rows are invalid.');
}

export async function countAdminUserRollups(options?: {
  q?: string;
  role?: 'client' | 'admin' | 'super_admin';
  accountStatuses?: Array<'active' | 'suspended' | 'pending_verification' | 'banned'>;
  quickFilter?: 'all' | 'live' | 'suspended' | 'banned' | 'low_credit';
}) {
  const supabase = getSupabaseAdmin();
  const query = applyAdminUserRollupFilters(
    supabase.from('admin_user_rollups').select('user_id', { head: true, count: 'exact' }),
    options,
  );

  const { count, error } = await query;
  assertSupabaseResult(error, 'Failed to count admin user rollups.');
  return count ?? 0;
}

export async function listAdminWallets(options?: { userIds?: string[] }): Promise<WalletRecord[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('wallets')
    .select('id, user_id, remaining_seconds, lifetime_seconds_purchased, lifetime_seconds_used, status')
    .order('updated_at', { ascending: false });

  if (options?.userIds && options.userIds.length > 0) {
    query = query.in('user_id', options.userIds);
  }

  const { data, error } = await query;

  assertSupabaseResult(error, 'Failed to load wallets.');
  return parseArray(data ?? [], walletRecordSchema, 'Wallet rows are invalid.');
}

export async function listAdminLowCreditUserIds(thresholdSeconds = 30 * 60) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('wallets')
    .select('user_id')
    .gt('remaining_seconds', 0)
    .lte('remaining_seconds', thresholdSeconds);

  assertSupabaseResult(error, 'Failed to load low-credit users.');
  return Array.from(new Set((data ?? []).map((row) => row.user_id as string)));
}

export async function listAdminWalletGrantsForUser(userId: string, limit = 12): Promise<WalletGrantRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('wallet_grants')
    .select(`
      id,
      user_id,
      wallet_id,
      source_transaction_id,
      grant_type,
      total_seconds,
      remaining_seconds,
      expires_at,
      description,
      metadata,
      created_by,
      created_at,
      updated_at,
      depleted_at,
      expired_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  assertSupabaseResult(error, 'Failed to load wallet grants.');
  return parseArray(data ?? [], walletGrantRecordSchema, 'Wallet grant rows are invalid.');
}

export async function listAdminUserIdsByFlagSearch(search: string) {
  const supabase = getSupabaseAdmin();
  const escaped = escapeIlikePattern(search.trim());
  const { data, error } = await supabase
    .from('user_flags')
    .select('user_id')
    .ilike('flag', `%${escaped}%`);

  assertSupabaseResult(error, 'Failed to search user flags.');
  return Array.from(new Set((data ?? []).map((row) => row.user_id as string)));
}

export async function listAdminUserFlags(userId?: string, userIds?: string[]): Promise<UserFlagRecord[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('user_flags')
    .select('id, user_id, flag, color, created_by, created_at')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (userIds && userIds.length > 0) {
    query = query.in('user_id', userIds);
  }

  const { data, error } = await query;

  assertSupabaseResult(error, 'Failed to load user flags.');
  return parseArray(data ?? [], userFlagRecordSchema, 'User flag rows are invalid.');
}

export async function listAdminActiveSessionUserIds(userIds?: string[]) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('sessions')
    .select('user_id')
    .eq('status', 'active');

  if (userIds && userIds.length > 0) {
    query = query.in('user_id', userIds);
  }

  const { data, error } = await query;

  assertSupabaseResult(error, 'Failed to load active session user ids.');
  return Array.from(new Set((data ?? []).map((row) => row.user_id as string)));
}

export async function listAdminPayments(): Promise<PaymentRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id,
      provider,
      provider_payment_id,
      amount_minor,
      currency,
      status,
      payment_type,
      created_at,
      paid_at,
      package_id,
      payment_packages (
        code,
        name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  assertSupabaseResult(error, 'Failed to load payments.');
  return parseArray(data ?? [], paymentRecordSchema, 'Payment rows are invalid.');
}

export async function listAdminPaymentPackages(): Promise<AdminPaymentPackageRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payment_packages')
    .select('id, code, name, description, seconds_to_credit, amount_minor, currency, provider_price_reference, is_active, sort_order, credit_expires_after_days')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  assertSupabaseResult(error, 'Failed to load payment packages.');
  return parseArray(data ?? [], adminPaymentPackageSchema, 'Admin payment package rows are invalid.');
}

export async function listAdminPaymentSummaries(options?: {
  status?: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded';
  provider?: 'stripe' | 'paymongo';
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminPaymentSummaryRecord[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('payments')
    .select(`
      id,
      user_id,
      provider,
      provider_payment_id,
      amount_minor,
      currency,
      status,
      payment_type,
      created_at,
      paid_at,
      payment_packages (
        code,
        name
      ),
      profiles:user_id (
        full_name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.provider) {
    query = query.eq('provider', options.provider);
  }

  const pageSize = options?.pageSize ?? 50;
  const page = options?.page ?? 1;
  const start = Math.max(0, (page - 1) * pageSize);
  query = query.range(start, start + pageSize - 1);

  const { data, error } = await query;

  assertSupabaseResult(error, 'Failed to load payment summaries.');
  let rows = parseArray(data ?? [], adminPaymentSummarySchema, 'Admin payment rows are invalid.');

  // Client-side search filter (supabase can't filter on joined table columns in .or())
  if (options?.search?.trim()) {
    const needle = options.search.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        (row.profiles?.full_name ?? '').toLowerCase().includes(needle) ||
        (row.profiles?.email ?? '').toLowerCase().includes(needle) ||
        (row.payment_packages?.name ?? '').toLowerCase().includes(needle) ||
        (row.payment_packages?.code ?? '').toLowerCase().includes(needle) ||
        row.provider_payment_id.toLowerCase().includes(needle),
    );
  }

  return rows;
}

export async function countAdminPaymentSummaries(options?: {
  status?: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded';
  provider?: 'stripe' | 'paymongo';
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('payments').select('*', { head: true, count: 'exact' });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.provider) {
    query = query.eq('provider', options.provider);
  }

  const { count, error } = await query;
  assertSupabaseResult(error, 'Failed to count payments.');
  return count ?? 0;
}

export async function listAdminPaymentSummariesForUser(userId: string, limit = 10): Promise<AdminPaymentSummaryRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id,
      user_id,
      provider,
      provider_payment_id,
      amount_minor,
      currency,
      status,
      payment_type,
      created_at,
      paid_at,
      payment_packages (
        code,
        name
      ),
      profiles:user_id (
        full_name,
        email
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  assertSupabaseResult(error, 'Failed to load payment summaries for the selected user.');
  return parseArray(data ?? [], adminPaymentSummarySchema, 'Admin payment rows are invalid.');
}

export async function listAdminSessions(): Promise<SessionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, used_seconds, start_time, end_time')
    .order('created_at', { ascending: false })
    .limit(50);

  assertSupabaseResult(error, 'Failed to load sessions.');
  return parseArray(data ?? [], sessionRecordSchema, 'Session rows are invalid.');
}

export async function listAdminSessionSummaries(options?: {
  userId?: string;
  userIds?: string[];
  limit?: number;
}): Promise<AdminSessionSummaryRecord[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('sessions')
    .select(`
      id,
      user_id,
      status,
      detection_mode,
      current_subject_id,
      current_category_id,
      used_seconds,
      start_time,
      end_time,
      last_activity_at,
      page_url,
      page_domain,
      page_title,
      profiles:user_id (
        full_name,
        email
      ),
      subjects:current_subject_id (
        name
      ),
      categories:current_category_id (
        name
      )
    `)
    .order('created_at', { ascending: false });

  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }

  if (options?.userIds && options.userIds.length > 0) {
    query = query.in('user_id', options.userIds);
  }

  if (typeof options?.limit === 'number') {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  assertSupabaseResult(error, 'Failed to load session summaries.');
  return parseArray(data ?? [], adminSessionSummarySchema, 'Admin session rows are invalid.');
}

export async function listAdminSessionAttemptSignals(sessionIds: string[]): Promise<AdminSessionAttemptSignalRecord[]> {
  if (sessionIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('question_attempts')
    .select(`
      id,
      session_id,
      created_at,
      page_url,
      page_title,
      no_match_reason,
      subjects:detected_subject_id (
        name
      ),
      categories:detected_category_id (
        name
      )
    `)
    .in('session_id', sessionIds)
    .order('created_at', { ascending: false });

  assertSupabaseResult(error, 'Failed to load session attempt signals.');
  return parseArray(data ?? [], adminSessionAttemptSignalSchema, 'Admin session attempt rows are invalid.');
}

export async function getAdminSessionDetail(sessionId: string): Promise<AdminSessionDetailRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id,
      user_id,
      status,
      detection_mode,
      current_subject_id,
      current_category_id,
      used_seconds,
      start_time,
      end_time,
      page_url,
      page_domain,
      page_title,
      extension_installation_id,
      last_activity_at,
      created_at,
      updated_at,
      profiles:user_id (
        full_name,
        email
      ),
      subjects:current_subject_id (
        name
      ),
      categories:current_category_id (
        name
      )
    `)
    .eq('id', sessionId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load session detail.');

  if (!data) {
    throw new RouteError(404, 'session_not_found', 'Session not found.');
  }

  return adminSessionDetailSchema.parse(data);
}

export async function listAdminQuestionAttemptsForSession(sessionId: string): Promise<QuestionAttemptSummaryRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('question_attempts')
    .select(`
      id,
      created_at,
      page_url,
      page_title,
      final_confidence,
      no_match_reason,
      answer_text,
      short_explanation,
      subjects:detected_subject_id (
        name
      ),
      categories:detected_category_id (
        name
      )
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  assertSupabaseResult(error, 'Failed to load session question attempts.');
  return parseArray(data ?? [], questionAttemptSummarySchema, 'Session question attempts are invalid.');
}

export async function listAdminCreditTransactionsForSession(sessionId: string): Promise<AdminCreditTransactionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('credit_transactions')
    .select(`
      id,
      user_id,
      wallet_id,
      transaction_type,
      delta_seconds,
      balance_after_seconds,
      related_payment_id,
      related_session_id,
      description,
      metadata,
      created_by,
      created_at
    `)
    .eq('related_session_id', sessionId)
    .order('created_at', { ascending: true });

  assertSupabaseResult(error, 'Failed to load session credit transactions.');
  return parseArray(data ?? [], adminCreditTransactionSchema, 'Session credit transactions are invalid.');
}

export async function listAdminCreditTransactionsForUser(userId: string, limit = 12): Promise<AdminCreditTransactionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('credit_transactions')
    .select(`
      id,
      user_id,
      wallet_id,
      transaction_type,
      delta_seconds,
      balance_after_seconds,
      related_payment_id,
      related_session_id,
      description,
      metadata,
      created_by,
      created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  assertSupabaseResult(error, 'Failed to load credit transactions for the selected user.');
  return parseArray(data ?? [], adminCreditTransactionSchema, 'User credit transactions are invalid.');
}

export async function listAdminUserDevices(userId: string): Promise<InstallationRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('extension_installations')
    .select('id, user_id, installation_status, device_name, browser_name, extension_version, last_seen_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  assertSupabaseResult(error, 'Failed to load extension installations for the selected user.');
  return parseArray(data ?? [], installationRecordSchema, 'Installation rows are invalid.');
}

export async function listAdminUserNotes(userId: string, limit = 20): Promise<UserAdminNoteRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_admin_notes')
    .select(`
      id,
      user_id,
      note,
      created_by,
      created_at,
      profiles:created_by (
        full_name,
        email
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  assertSupabaseResult(error, 'Failed to load admin notes for the selected user.');
  return parseArray(data ?? [], userAdminNoteRecordSchema, 'User admin note rows are invalid.');
}

export async function getAdminUserAccessOverride(userId: string): Promise<UserAccessOverrideRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_access_overrides')
    .select(`
      user_id,
      can_use_extension,
      can_buy_credits,
      max_active_devices,
      daily_usage_limit_seconds,
      monthly_usage_limit_seconds,
      feature_flags,
      updated_by,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load user access overrides.');
  return data ? userAccessOverrideRecordSchema.parse(data) : null;
}

export async function listRecentQuestionAttempts(userId: string, limit = 10): Promise<QuestionAttemptSummaryRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('question_attempts')
    .select(`
      id,
      created_at,
      page_url,
      page_title,
      final_confidence,
      no_match_reason,
      answer_text,
      short_explanation,
      subjects:detected_subject_id (
        name
      ),
      categories:detected_category_id (
        name
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  assertSupabaseResult(error, 'Failed to load question attempts.');
  return parseArray(data ?? [], questionAttemptSummarySchema, 'Question attempt rows are invalid.');
}

export async function listAdminAuditLogs(limit = 50): Promise<AdminAuditLogRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      id,
      actor_user_id,
      actor_role,
      event_type,
      entity_type,
      entity_id,
      event_summary,
      created_at,
      profiles:actor_user_id (
        full_name,
        email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  assertSupabaseResult(error, 'Failed to load audit logs.');
  return parseArray(data ?? [], adminAuditLogSchema, 'Audit log rows are invalid.');
}

export async function getAdminDashboardSummary() {
  const supabase = getSupabaseAdmin();
  const [profiles, sessionsToday, purchases, lowConfidence, sourceFailures, questionAttempts] = await Promise.all([
    supabase.from('profiles').select('*', { head: true, count: 'exact' }),
    supabase
      .from('sessions')
      .select('*', { head: true, count: 'exact' })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('credit_transactions').select('delta_seconds').eq('transaction_type', 'purchase'),
    supabase.from('question_attempts').select('final_confidence').not('final_confidence', 'is', null),
    supabase.from('source_files').select('*', { head: true, count: 'exact' }).eq('source_status', 'failed').is('deleted_at', null),
    supabase
      .from('question_attempts')
      .select(`
        id,
        created_at,
        page_url,
        page_title,
        final_confidence,
        no_match_reason,
        answer_text,
        short_explanation,
        subjects:detected_subject_id (
          name
        ),
        categories:detected_category_id (
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  assertSupabaseResult(profiles.error, 'Failed to count profiles.');
  assertSupabaseResult(sessionsToday.error, 'Failed to count sessions.');
  assertSupabaseResult(purchases.error, 'Failed to load purchases.');
  assertSupabaseResult(lowConfidence.error, 'Failed to load confidence metrics.');
  assertSupabaseResult(sourceFailures.error, 'Failed to load source failure metrics.');
  assertSupabaseResult(questionAttempts.error, 'Failed to load question attempts.');

  const creditsSoldSeconds = (purchases.data ?? []).reduce((sum, row) => sum + (row.delta_seconds ?? 0), 0);
  const lowConfidenceRows = (lowConfidence.data ?? []).filter(
    (row) => typeof row.final_confidence === 'number' && row.final_confidence < 0.65,
  );
  const lowConfidenceRate =
    (lowConfidence.data?.length ?? 0) > 0 ? lowConfidenceRows.length / (lowConfidence.data?.length ?? 1) : 0;

  const recentAttempts = parseArray(
    questionAttempts.data ?? [],
    questionAttemptSummarySchema,
    'Recent question attempts are invalid.',
  );

  return {
    totalUsers: profiles.count ?? 0,
    sessionsToday: sessionsToday.count ?? 0,
    creditsSoldSeconds,
    lowConfidenceRate,
    sourceFailures: sourceFailures.count ?? 0,
    recentAttempts,
  };
}
