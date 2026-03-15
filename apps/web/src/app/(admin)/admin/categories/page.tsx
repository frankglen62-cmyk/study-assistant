import { Button } from '@study-assistant/ui';
import { Plus } from 'lucide-react';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { AdminCategoryForm } from '@/features/admin/config-forms';
import { AdminCategoryActions } from '@/features/admin/admin-category-actions';
import { requirePageUser } from '@/lib/auth/page-context';
import { getAdminCategoriesPageData } from '@/features/admin/server';

export default async function AdminCategoriesPage() {
  await requirePageUser(['admin', 'super_admin']);
  const categories = await getAdminCategoriesPageData();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Retrieval Scope"
        title="Categories"
        description="Assign per-subject or global categories that help narrow retrieval to the most relevant exam window or content group."
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        }
      />
      <DataTable
        columns={['Name', 'Subject', 'Keywords', 'Sort Order', 'Status', 'Actions']}
        emptyMessage="No categories have been created yet."
        rows={categories.map((category) => [
          <div key={`${category.id}-name`} className="font-medium">{category.name}</div>,
          category.subjectName,
          <div key={`${category.id}-kw`} className="max-w-[180px] truncate text-xs text-muted-foreground">{category.default_keywords.join(', ')}</div>,
          <code key={`${category.id}-sort`} className="text-xs font-mono text-muted-foreground">Configured in database</code>,
          <StatusBadge key={`${category.id}-status`} status={category.is_active ? 'active' : 'archived'} />,
          <AdminCategoryActions
            key={`${category.id}-actions`}
            categoryId={category.id}
            categoryName={category.name}
            isActive={category.is_active}
          />,
        ])}
      />
      <AdminCategoryForm />
    </div>
  );
}
