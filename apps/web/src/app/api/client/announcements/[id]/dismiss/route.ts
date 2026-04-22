import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_CLIENT_MUTATE } from '@/lib/security/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
    assertRateLimit(`dismiss-announce:${context.userId}`, RL_CLIENT_MUTATE);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', context.userId);

    return jsonOk({ success: true }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
