import { PageHeading } from '@/components/page-heading';
import { AdminSystemSettingsForm } from '@/features/admin/config-forms';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Platform Controls"
        title="Settings"
        description="Manage payment flags, low-credit thresholds, live mode defaults, file rules, and system-wide banner messaging."
      />
      <AdminSystemSettingsForm />
    </div>
  );
}
