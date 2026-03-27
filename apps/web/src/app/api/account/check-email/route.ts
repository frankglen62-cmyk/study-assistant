import { RouteError, getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const supabase = await getSupabaseServerSessionClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      throw new RouteError(401, 'unauthorized', 'Session expired.');
    }

    return jsonOk({ email: user.email }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
