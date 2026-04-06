import { Button } from '@study-assistant/ui';

import { DataTable } from '@/components/data-table';
import { MetricCard } from '@/components/metric-card';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { requirePageUser } from '@/lib/auth/page-context';
import { AdminPaymentPackageManager } from '@/features/admin/admin-payment-package-manager';
import { getAdminPaymentsPageData } from '@/features/admin/server';

export default async function AdminPaymentsPage() {
  await requirePageUser(['admin', 'super_admin']);
  const payments = await getAdminPaymentsPageData();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Billing Ops"
        title="Payments"
        description="Review provider status, payment outcomes, and refund or receipt follow-up actions."
      />
      <div className="grid gap-6 xl:grid-cols-4">
        {payments.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} delta={metric.delta} tone={metric.tone} />
        ))}
      </div>
      <AdminPaymentPackageManager packages={payments.packages} />
      <DataTable
        columns={['Date', 'User', 'Package', 'Provider', 'Amount', 'Status', 'Actions']}
        emptyMessage="No payment records are available yet."
        rows={payments.payments.map((payment) => [
          payment.createdAt,
          <div key={`${payment.id}-user`} className="space-y-1">
            <p className="font-medium">{payment.userName}</p>
            <p className="text-xs text-muted-foreground">{payment.userEmail}</p>
          </div>,
          payment.packageName,
          payment.provider,
          payment.amount,
          <StatusBadge key={`${payment.id}-status`} status={payment.status} />,
          <div key={`${payment.id}-actions`} className="flex gap-2">
            <Button size="sm" variant="secondary">View Details</Button>
            <Button size="sm" variant="secondary">Mark Reviewed</Button>
            <Button size="sm" variant="secondary">Refund</Button>
          </div>,
        ])}
      />
    </div>
  );
}
