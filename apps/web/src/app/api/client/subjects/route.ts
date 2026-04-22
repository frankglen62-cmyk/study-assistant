import { getActiveCatalog } from '@/lib/supabase/catalog';
import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { assertRateLimit, RL_CLIENT_READ } from '@/lib/security/rate-limit';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    // Ensure the user is authenticated as a client
    const context = await requireClientUser(request);
    assertRateLimit(`client-subjects:${context.userId}`, RL_CLIENT_READ);
    
    // Fetch active subjects and categories
    const catalog = await getActiveCatalog();
    
    // Format response to match standard Next.js route handlers in this project
    return jsonOk(catalog, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
