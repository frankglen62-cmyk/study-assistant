import { unstable_noStore as noStore } from 'next/cache';

import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { getAdminSourcesPageData } from '@/features/admin/server';
import { AdminSourceManager } from '@/features/admin/admin-source-manager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminSourcesPage() {
  noStore();
  await requirePageUser(['admin', 'super_admin']);
  const sources = await getAdminSourcesPageData();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Source Library"
        title="Sources"
        description="Manage per-subject Q&A storage, private folders, and secondary file-based source ingestion from one admin workspace."
        badge="Admin only"
      />
      <AdminSourceManager
        folders={sources.folders}
        sourceFiles={sources.sourceFiles}
        initialQaPairs={sources.initialQaPairs}
        qaPairCounts={sources.qaPairCounts}
        subjects={sources.subjects.map((subject) => ({
          id: subject.id,
          name: subject.name,
          courseCode: subject.course_code,
        }))}
      />
    </div>
  );
}
