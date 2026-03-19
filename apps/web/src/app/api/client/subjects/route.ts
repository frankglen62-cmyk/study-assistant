import { getActiveCatalog } from '@/lib/supabase/catalog';
import { requireClientUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    // Ensure the user is authenticated as a client
    await requireClientUser(request);
    
    // Fetch active subjects and categories
    const catalog = await getActiveCatalog();
    
    // Format response to match standard Next.js route handlers in this project
    return jsonOk(catalog, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
