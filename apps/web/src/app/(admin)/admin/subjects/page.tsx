import { Button } from '@study-assistant/ui';
import { Plus } from 'lucide-react';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { AdminSubjectForm } from '@/features/admin/config-forms';
import { AdminSubjectActions } from '@/features/admin/admin-subject-actions';
import { requirePageUser } from '@/lib/auth/page-context';
import { getAdminSubjectsPageData } from '@/features/admin/server';

export default async function AdminSubjectsPage() {
  await requirePageUser(['admin', 'super_admin']);
  const subjects = await getAdminSubjectsPageData();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Detection Rules"
        title="Subjects"
        description="Configure course codes, keyword sets, URL patterns, and activation state for each subject."
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Subject
          </Button>
        }
      />
      <DataTable
        columns={['Name', 'Course Code', 'Keywords', 'URL Patterns', 'Status', 'Actions']}
        emptyMessage="No subjects have been created yet."
        rows={subjects.map((subject) => [
          <div key={`${subject.id}-name`} className="font-medium">{subject.name}</div>,
          <code key={`${subject.id}-code`} className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono">{subject.course_code ?? 'n/a'}</code>,
          <div key={`${subject.id}-kw`} className="max-w-[180px] truncate text-xs text-muted-foreground">{subject.keywords.join(', ')}</div>,
          <div key={`${subject.id}-url`} className="max-w-[180px] truncate text-xs text-muted-foreground font-mono">{subject.url_patterns.join(', ')}</div>,
          <StatusBadge key={`${subject.id}-status`} status={subject.is_active ? 'active' : 'archived'} />,
          <AdminSubjectActions
            key={`${subject.id}-actions`}
            subjectId={subject.id}
            subjectName={subject.name}
            isActive={subject.is_active}
          />,
        ])}
      />
      <AdminSubjectForm />
    </div>
  );
}
