import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk, parseJsonBody } from '@/lib/http/route';
import { getUserPreferences, upsertUserPreferences } from '@/lib/supabase/user-preferences';
import { z } from 'zod';

const preferencesSchema = z.object({
  appearanceMode: z.enum(['light', 'dark', 'system']),
});

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['client', 'admin', 'super_admin']);
    const preferences = await getUserPreferences(context.userId);
    
    return jsonOk(
      {
        preferences: {
          appearanceMode: preferences.appearance_mode,
        },
      },
      requestId
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    const context = await requirePortalUser(request, ['client', 'admin', 'super_admin']);
    const body = await parseJsonBody(request, preferencesSchema);
    
    const preferences = await upsertUserPreferences(context.userId, {
      appearance_mode: body.appearanceMode,
    });

    return jsonOk(
      {
        preferences: {
          appearanceMode: preferences.appearance_mode,
        },
      },
      requestId
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
