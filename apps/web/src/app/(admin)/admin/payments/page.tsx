import { MetricCard } from '@/components/metric-card';
import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { AdminPaymentsManager } from '@/features/admin/admin-payments-manager';
import { getAdminPaymentsPageData } from '@/features/admin/server';

export default async function AdminPaymentsPage() {
  await requirePageUser(['admin', 'super_admin']);
  const data = await getAdminPaymentsPageData();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Billing Ops"
        title="Payments"
        description="Review real-time payment history, manage credit packages, and track revenue from PayMongo and Stripe."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} delta={metric.delta} tone={metric.tone} />
        ))}
      </div>
      <AdminPaymentsManager
        payments={data.payments}
        packages={data.packages}
        statusCounts={data.statusCounts}
      />
    </div>
  );
}
