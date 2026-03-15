import type { AdminSubjectQaCountResponse } from '@study-assistant/shared-types';

import { requirePortalUser } from '@/lib/auth/request-context';
import { getRequestMeta, jsonError, jsonOk } from '@/lib/http/route';
import { listAdminSubjects } from '@/lib/supabase/admin';
import { countAdminSubjectQaPairsBySubjectIds } from '@/lib/supabase/subject-qa';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    await requirePortalUser(request, ['admin', 'super_admin']);

    const subjects = await listAdminSubjects();
    const activeSubjects = subjects.filter((subject) => subject.is_active);
    const counts = await countAdminSubjectQaPairsBySubjectIds(activeSubjects.map((subject) => subject.id));

    return jsonOk<AdminSubjectQaCountResponse>(
      {
        counts: Object.fromEntries(counts.entries()),
      },
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
