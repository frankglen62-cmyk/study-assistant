'use client';

import Link from 'next/link';
import { CreditCard, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatDuration } from '@study-assistant/shared-utils';

import { Badge, Button, Progress } from '@study-assistant/ui';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';

type PaymentEntry = {
  id: string;
  date: string;
  package: string;
  provider: string;
  amount: string;
  status: string;
};

type BillingTabProps = {
  wallet: {
    remaining_seconds: number;
  };
  paymentHistory: PaymentEntry[];
};

export function BillingTab({ wallet, paymentHistory }: BillingTabProps) {
  const remainingPercent = Math.min((wallet.remaining_seconds / 18000) * 100, 100);

  return (
    <div className="space-y-8">
      {/* Balance Overview */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1">Current Balance</h3>
        <p className="text-xs text-muted-foreground mb-5">Your available credits for AI analysis sessions.</p>

        <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-accent/5 via-accent/[0.02] to-transparent p-6 shadow-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" /> Active Balance
              </p>
              <p className="text-4xl font-display text-foreground">{formatDuration(wallet.remaining_seconds)}</p>
              <p className="text-sm text-muted-foreground">Available for immediate AI analysis.</p>
            </div>
            <div className="w-full md:max-w-xs space-y-2">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>0%</span>
                <span>Max (5 hrs)</span>
              </div>
              <Progress value={remainingPercent} className="h-3" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href="/buy-credits">
                <CreditCard className="h-4 w-4" />
                Buy Credits
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Payment History */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Payment History</h3>
        </div>
        <DataTable
          columns={['Date', 'Package', 'Provider', 'Amount', 'Status']}
          emptyMessage="No billing history yet. Your transactions will appear here."
          rows={paymentHistory.map((payment) => [
            payment.date,
            payment.package,
            payment.provider,
            payment.amount,
            <StatusBadge key={`${payment.id}-status`} status={payment.status} />,
          ])}
        />
      </section>
    </div>
  );
}
