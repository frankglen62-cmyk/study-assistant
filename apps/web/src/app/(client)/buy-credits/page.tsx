import Link from 'next/link';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@study-assistant/ui';
import { Check, CreditCard, Smartphone, Landmark, Zap, History, ShieldCheck } from 'lucide-react';
import { formatDuration } from '@study-assistant/shared-utils';

import { DataTable } from '@/components/data-table';
import { PageHeading } from '@/components/page-heading';
import { StatusBadge } from '@/components/status-badge';
import { requirePageUser } from '@/lib/auth/page-context';
import { PackageCardAction } from '@/features/client/buy-credits-actions';
import { getClientBillingData } from '@/features/client/server';

export default async function BuyCreditsPage() {
  const context = await requirePageUser(['client']);
  const billing = await getClientBillingData(context.userId);

  const remainingPercent = Math.min((context.wallet.remaining_seconds / 18000) * 100, 100);

  return (
    <div className="space-y-8 pb-12">
      <PageHeading
        eyebrow="Billing"
        title="Buy Credits"
        description="Choose a time package to top up your account. Pay with card or scan-to-pay options like QRPh, GCash, Maya, and supported bank apps."
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/account"><History className="h-4 w-4" /> View Payment History</Link>
            </Button>
          </>
        }
      />

      {/* Active Balance Card */}
      <div className="rounded-2xl bg-gradient-to-br from-accent/10 via-emerald-50/50 to-blue-50/30 dark:from-accent/5 dark:via-accent/5 dark:to-transparent p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2"><Zap className="h-4 w-4 text-accent" /> Active Balance</p>
            <p className="text-4xl font-display text-foreground">{formatDuration(context.wallet.remaining_seconds)}</p>
            <p className="text-sm text-muted-foreground">Available for immediate AI analysis.</p>
          </div>
          <div className="w-full md:max-w-md space-y-2">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>0%</span>
              <span>Max (5 hrs)</span>
            </div>
            <Progress value={remainingPercent} className="h-3" />
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {billing.packages.map((pkg) => (
          <div key={pkg.id} className={`rounded-2xl border bg-background p-0 shadow-card relative overflow-hidden flex flex-col transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 ${pkg.featured ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border/40'}`}>
            {pkg.featured && (
              <div className="absolute top-4 right-4">
                <Badge tone="accent" className="text-xs">Recommended</Badge>
              </div>
            )}
            <div className="p-6 pb-4">
              <p className="text-lg font-semibold text-foreground">{pkg.name}</p>
              <p className="mt-1.5 text-sm text-muted-foreground h-10">{pkg.description}</p>
            </div>
            <div className="px-6 pb-6 space-y-6 flex-1 flex flex-col">
              <div className="space-y-1">
                <p className="font-display text-5xl text-foreground">{pkg.price}</p>
                <p className="text-xs font-medium text-muted-foreground">One-time payment</p>
              </div>

              <ul className="space-y-3 py-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Instant credit delivery</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Credits never expire</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Full access to all models</span>
                </li>
                {pkg.supportsPaymongo ? (
                  <li className="flex items-start gap-2.5">
                    <Smartphone className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span>QRPh, GCash, Maya, bank app scan</span>
                  </li>
                ) : null}
                {pkg.supportsStripe ? (
                  <li className="flex items-start gap-2.5">
                    <CreditCard className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span>Card checkout via Stripe</span>
                  </li>
                ) : null}
              </ul>

              <div className="grid gap-3 pt-2 mt-auto">
                <PackageCardAction
                  packageId={pkg.id}
                  supportsStripe={pkg.supportsStripe}
                  supportsPaymongo={pkg.supportsPaymongo}
                />
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground">Gift this package</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Methods Info */}
      <div className="rounded-2xl border border-border/40 bg-background p-6 shadow-card">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
            <Landmark className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-lg font-semibold text-foreground">Payment Methods</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Card checkout uses Stripe. PayMongo handles QRPh, GCash, Maya, and supported bank app checkout when the provider is enabled for your deployment.
        </p>
      </div>

      {/* Transaction History */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-xl font-semibold text-foreground">Recent Transactions</h3>
        </div>
        <DataTable
          columns={['Date', 'Package', 'Provider', 'Amount', 'Status']}
          emptyMessage="No billing history yet. Your transactions will appear here."
          rows={billing.paymentHistory.map((payment) => [
            payment.date,
            payment.package,
            payment.provider,
            payment.amount,
            <StatusBadge key={`${payment.id}-status`} status={payment.status} />,
          ])}
        />
      </div>
    </div>
  );
}
