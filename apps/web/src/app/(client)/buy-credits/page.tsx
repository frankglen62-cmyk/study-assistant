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
      <div className="border-4 border-black bg-accent p-8 shadow-solid-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black flex items-center gap-2"><Zap className="h-5 w-5 text-black" /> Active Balance</p>
            <p className="text-5xl font-display font-black uppercase tracking-tighter text-black">{formatDuration(context.wallet.remaining_seconds)}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-black/70">Available for immediate AI analysis.</p>
          </div>
          <div className="w-full md:max-w-md space-y-3 relative">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-black/60">
              <span>0%</span>
              <span>Max (5 hrs)</span>
            </div>
            <Progress value={remainingPercent} className="h-6" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {billing.packages.map((pkg) => (
          <div key={pkg.id} className={`border-4 bg-surface p-0 shadow-solid-md relative overflow-hidden flex flex-col ${pkg.featured ? 'border-accent bg-accent/5' : 'border-black'}`}>
            {pkg.featured && (
              <div className="absolute top-0 right-0">
                <div className="bg-accent text-black px-4 py-2 text-[10px] font-black uppercase tracking-widest border-l-4 border-b-4 border-black">Recommended</div>
              </div>
            )}
            <div className="p-6 pb-4 border-b-4 border-black/10">
              <p className="font-display text-2xl font-black uppercase text-black">{pkg.name}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-black/60 h-10">{pkg.description}</p>
            </div>
            <div className="p-6 space-y-6 flex-1 flex flex-col">
              <div className="space-y-1">
                <p className="font-display text-6xl font-black tracking-tighter text-black">{pkg.price}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/50">One-time payment</p>
              </div>
              
              <ul className="space-y-3 py-2 text-xs font-bold uppercase tracking-widest text-black/80">
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
                    <span>GCash, Maya, online bank</span>
                  </li>
                ) : null}
                {pkg.supportsStripe ? (
                  <li className="flex items-start gap-3">
                    <CreditCard className="h-4 w-4 text-success shrink-0 mt-0.5" />
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
                <Button variant="secondary" className="w-full">Gift this package</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center border-4 border-black bg-accent">
            <Landmark className="h-6 w-6 text-black" />
          </div>
          <p className="font-display text-xl font-black uppercase text-black">Payment methods</p>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-black/60">
          Card checkout uses Stripe. GCash, Maya, and online bank checkout use PayMongo when the provider is enabled for your deployment.
        </p>
      </div>
      
      <div className="space-y-6 pt-4">
        <h3 className="font-display text-3xl font-black uppercase text-black border-l-8 border-accent pl-4 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6" /> Recent Transactions
        </h3>
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
