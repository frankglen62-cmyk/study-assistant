import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requireClientUser(request);
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
