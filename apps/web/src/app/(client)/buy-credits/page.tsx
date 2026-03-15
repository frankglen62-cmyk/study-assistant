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
        description="Choose a time package to top up your account. Students can pay with card or PH-friendly wallets like GCash and Maya when the provider is enabled."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/account"><History className="mr-2 h-4 w-4" /> View Payment History</Link>
            </Button>
          </>
        }
      />

      {/* Active Balance Card */}
      <Card className="bg-gradient-to-br from-surface/80 to-background/40 border-border/70 border-x-accent/20 border-t-accent/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Zap className="h-4 w-4 text-accent" /> Active Balance</p>
              <p className="text-4xl font-display font-semibold tracking-tight">{formatDuration(context.wallet.remaining_seconds)}</p>
              <p className="text-sm text-muted-foreground">Available for immediate AI analysis.</p>
            </div>
            <div className="w-full md:max-w-md space-y-2 relative">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>0%</span>
                <span>Max (5 hrs)</span>
              </div>
              <Progress value={remainingPercent} className="h-2.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {billing.packages.map((pkg) => (
          <Card key={pkg.id} className={pkg.featured ? 'border-accent shadow-[0_0_40px_-15px_rgba(var(--accent),0.3)] relative overflow-hidden' : 'relative overflow-hidden'}>
            {pkg.featured && (
              <div className="absolute top-4 right-4 animate-in fade-in zoom-in spin-in-12">
                <Badge tone="accent" className="shadow-lg">Recommended</Badge>
              </div>
            )}
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-display">{pkg.name}</CardTitle>
              <CardDescription className="h-10">{pkg.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1">
                <p className="font-display text-5xl font-semibold tracking-tight">{pkg.price}</p>
                <p className="text-sm text-muted-foreground text-opacity-80">One-time payment</p>
              </div>
              
              <ul className="space-y-3 py-2 text-sm text-foreground/80">
                <li className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <span>Instant credit delivery</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <span>Credits never expire</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <span>Full access to all models</span>
                </li>
                {pkg.supportsPaymongo ? (
                  <li className="flex items-start gap-3">
                    <Smartphone className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <span>GCash, Maya, and online bank checkout</span>
                  </li>
                ) : null}
                {pkg.supportsStripe ? (
                  <li className="flex items-start gap-3">
                    <CreditCard className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <span>Card checkout via Stripe</span>
                  </li>
                ) : null}
              </ul>
              
              <div className="grid gap-3 pt-2">
                <PackageCardAction
                  packageId={pkg.id}
                  supportsStripe={pkg.supportsStripe}
                  supportsPaymongo={pkg.supportsPaymongo}
                />
                <Button variant="secondary" className="w-full">Gift this package</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Landmark className="h-5 w-5 text-accent" />
            Payment methods
          </CardTitle>
          <CardDescription>
            Card checkout uses Stripe. GCash, Maya, and online bank checkout use PayMongo when the provider is enabled for your deployment.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" /> Recent Transactions
        </h3>
        <Card className="overflow-hidden">
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
        </Card>
      </div>
    </div>
  );
}
