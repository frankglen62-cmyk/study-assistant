import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { assertSupabaseResult } from '@/lib/supabase/utils';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    await requirePortalUser(request, ['admin', 'super_admin']);
    const supabase = getSupabaseAdmin();

    const [profiles, sessionsToday, creditsSold, failedAttempts] = await Promise.all([
      supabase.from('profiles').select('*', { head: true, count: 'exact' }),
      supabase
        .from('sessions')
        .select('*', { head: true, count: 'exact' })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('credit_transactions')
        .select('delta_seconds')
        .eq('transaction_type', 'purchase'),
      supabase
        .from('question_attempts')
        .select('*', { head: true, count: 'exact' })
        .not('no_match_reason', 'is', null),
    ]);

    assertSupabaseResult(profiles.error, 'Failed to count profiles.');
    assertSupabaseResult(sessionsToday.error, 'Failed to count sessions.');
    assertSupabaseResult(creditsSold.error, 'Failed to read credit transactions.');
    assertSupabaseResult(failedAttempts.error, 'Failed to count failed attempts.');

    const totalCreditsSold = (creditsSold.data ?? []).reduce((sum, row) => sum + (row.delta_seconds ?? 0), 0);

    return jsonOk(
      {
        totalUsers: profiles.count ?? 0,
        sessionsToday: sessionsToday.count ?? 0,
        creditsSoldSeconds: totalCreditsSold,
        failedDetections: failedAttempts.count ?? 0,
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
