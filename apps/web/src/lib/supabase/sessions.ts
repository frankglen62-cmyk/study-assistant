import { RouteError } from '@/lib/http/route';

import { sessionRecordSchema, type SessionRecord } from './schemas';
import { getSupabaseAdmin } from './server';
import { assertSupabaseResult, parseArray, parseSingle } from './utils';

export async function getOpenSessionForUser(userId: string): Promise<SessionRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load open session.');

  return data ? parseSingle(data, sessionRecordSchema, 'Session row is invalid.') : null;
}

export async function listSessionsForUser(userId: string, limit = 20): Promise<SessionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  assertSupabaseResult(error, 'Failed to load session history.');
  return parseArray(data ?? [], sessionRecordSchema, 'Session history rows are invalid.');
}

export async function sumUsageDebitsForUserSince(params: {
  userId: string;
  since: string;
  until?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('credit_transactions')
    .select('delta_seconds')
    .eq('user_id', params.userId)
    .eq('transaction_type', 'usage_debit')
    .gte('created_at', params.since);

  if (params.until) {
    query = query.lt('created_at', params.until);
  }

  const { data, error } = await query;

  assertSupabaseResult(error, 'Failed to load session usage debits.');
  return (data ?? []).reduce((sum, row) => sum + Math.max(0, Math.abs(row.delta_seconds ?? 0)), 0);
}

export async function createActiveSession(params: {
  userId: string;
  installationId: string | null;
  detectionMode?: 'auto' | 'manual';
  pageUrl?: string | null;
  pageDomain?: string | null;
  pageTitle?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: params.userId,
      extension_installation_id: params.installationId,
      status: 'active',
      start_time: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      detection_mode: params.detectionMode ?? 'auto',
      page_url: params.pageUrl ?? null,
      page_domain: params.pageDomain ?? null,
      page_title: params.pageTitle ?? null,
    })
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time')
    .single();

  assertSupabaseResult(error, 'Failed to create session.');
  return parseSingle(data, sessionRecordSchema, 'Created session is invalid.');
}

export async function getSessionByIdForUser(sessionId: string, userId: string): Promise<SessionRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to load session.');

  if (!data) {
    throw new RouteError(404, 'session_not_found', 'Session not found.');
  }

  return parseSingle(data, sessionRecordSchema, 'Session row is invalid.');
}

export async function updateSessionStatus(params: {
  sessionId: string;
  userId: string;
  status: 'active' | 'paused' | 'ended' | 'timed_out' | 'no_credit' | 'no_match' | 'failed';
}) {
  const supabase = getSupabaseAdmin();
  const updates: Record<string, unknown> = {
    status: params.status,
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  };

  if (params.status === 'ended' || params.status === 'timed_out' || params.status === 'no_credit' || params.status === 'failed') {
    updates.end_time = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', params.sessionId)
    .eq('user_id', params.userId)
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time')
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to update session status.');

  if (!data) {
    throw new RouteError(404, 'session_not_found', 'Session not found.');
  }

  return parseSingle(data, sessionRecordSchema, 'Updated session is invalid.');
}

export async function syncSessionAfterAnalysis(params: {
  sessionId: string;
  userId: string;
  subjectId: string | null;
  categoryId: string | null;
  detectionMode: 'auto' | 'manual';
  usedSecondsDelta: number;
  pageUrl: string;
  pageDomain: string;
  pageTitle: string;
  nextStatus?: 'active' | 'no_match';
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .update({
      current_subject_id: params.subjectId,
      current_category_id: params.categoryId,
      detection_mode: params.detectionMode,
      page_url: params.pageUrl,
      page_domain: params.pageDomain,
      page_title: params.pageTitle,
      status: params.nextStatus ?? 'active',
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.sessionId)
    .eq('user_id', params.userId)
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time')
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to sync session after analysis.');

  if (!data) {
    throw new RouteError(404, 'session_not_found', 'Session not found.');
  }

  const parsed = parseSingle(data, sessionRecordSchema, 'Synced session is invalid.');

  if (params.usedSecondsDelta <= 0) {
    return parsed;
  }

  const usageUpdate = await supabase
    .from('sessions')
    .update({
      used_seconds: parsed.used_seconds + params.usedSecondsDelta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.sessionId)
    .eq('user_id', params.userId)
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time')
    .single();

  assertSupabaseResult(usageUpdate.error, 'Failed to increment session usage.');
  return parseSingle(usageUpdate.data, sessionRecordSchema, 'Incremented session is invalid.');
}

export async function recordSessionUsage(params: {
  sessionId: string;
  userId: string;
  usedSeconds: number;
  lastActivityAt: string;
  status?: SessionRecord['status'];
}) {
  const supabase = getSupabaseAdmin();
  const updates: Record<string, unknown> = {
    used_seconds: params.usedSeconds,
    last_activity_at: params.lastActivityAt,
    updated_at: new Date().toISOString(),
  };

  if (params.status) {
    updates.status = params.status;
  }

  if (params.status === 'ended' || params.status === 'timed_out' || params.status === 'no_credit' || params.status === 'failed') {
    updates.end_time = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', params.sessionId)
    .eq('user_id', params.userId)
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time')
    .maybeSingle();

  assertSupabaseResult(error, 'Failed to record session usage.');

  if (!data) {
    throw new RouteError(404, 'session_not_found', 'Session not found.');
  }

  return parseSingle(data, sessionRecordSchema, 'Updated session usage is invalid.');
}

export async function updateOpenSessionsStatusForUser(params: {
  userId: string;
  status: 'ended' | 'no_credit' | 'failed';
}) {
  const supabase = getSupabaseAdmin();
  const { data: openSessions, error: loadError } = await supabase
    .from('sessions')
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time')
    .eq('user_id', params.userId)
    .in('status', ['active', 'paused'])
    .is('end_time', null);

  assertSupabaseResult(loadError, 'Failed to inspect open sessions.');

  const sessions = parseArray(openSessions ?? [], sessionRecordSchema, 'Open session rows are invalid.');

  if (sessions.length === 0) {
    return {
      count: 0,
      sessions: [],
    };
  }

  const { data, error } = await supabase
    .from('sessions')
    .update({
      status: params.status,
      end_time: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', params.userId)
    .in('status', ['active', 'paused'])
    .is('end_time', null)
    .select('id, user_id, status, detection_mode, current_subject_id, current_category_id, extension_installation_id, used_seconds, start_time, last_activity_at, end_time');

  assertSupabaseResult(error, 'Failed to close open sessions.');

  return {
    count: data?.length ?? 0,
    sessions: parseArray(data ?? [], sessionRecordSchema, 'Closed session rows are invalid.'),
  };
}

export async function createQuestionAttempt(payload: {
  sessionId: string;
  userId: string;
  pageUrl: string;
  pageTitle: string;
  extractedQuestionText: string | null;
  extractedOptions: string[] | null;
  selectedSubjectId: string | null;
  detectedSubjectId: string | null;
  selectedCategoryId: string | null;
  detectedCategoryId: string | null;
  detectionConfidence: number | null;
  retrievalConfidence: number | null;
  finalConfidence: number | null;
  answerText: string | null;
  shortExplanation: string | null;
  answerSchema: Record<string, unknown>;
  noMatchReason: string | null;
  processingMs: number;
  modelUsed: string;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('question_attempts').insert({
    session_id: payload.sessionId,
    user_id: payload.userId,
    page_url: payload.pageUrl,
    page_title: payload.pageTitle,
    extracted_question_text: payload.extractedQuestionText,
    extracted_options: payload.extractedOptions,
    selected_subject_id: payload.selectedSubjectId,
    detected_subject_id: payload.detectedSubjectId,
    selected_category_id: payload.selectedCategoryId,
    detected_category_id: payload.detectedCategoryId,
    detection_confidence: payload.detectionConfidence,
    retrieval_confidence: payload.retrievalConfidence,
    final_confidence: payload.finalConfidence,
    answer_text: payload.answerText,
    short_explanation: payload.shortExplanation,
    answer_schema: payload.answerSchema,
    no_match_reason: payload.noMatchReason,
    processing_ms: payload.processingMs,
    model_used: payload.modelUsed,
  });

  assertSupabaseResult(error, 'Failed to store question attempt.');
}
