import { Check } from 'lucide-react';

import { formatDuration, formatCurrency } from '@study-assistant/shared-utils';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

const packages = [
  { code: 'starter-1h', name: '1 hour', seconds: 3600, amount: 900, description: 'Good for occasional review sessions.' },
  { code: 'plus-3h', name: '3 hours', seconds: 10800, amount: 2400, description: 'Balanced option for weekly quiz prep.' },
  { code: 'pro-5h', name: '5 hours', seconds: 18000, amount: 3600, description: 'Best for active semester support.' },
  { code: 'team-10h', name: '10 hours', seconds: 36000, amount: 6500, description: 'High-usage plan for advanced learners.' },
];

export default function PricingPage() {
  return (
    <div className="page-shell space-y-10 py-12">
      <div className="max-w-3xl space-y-4">
        <p className="text-sm uppercase tracking-[0.18em] text-accent">Pricing</p>
        <h1 className="font-display text-5xl font-semibold tracking-tight">Time-credit packages with fair usage rules.</h1>
        <p className="text-lg text-muted-foreground">
          Credits are stored as integer seconds, charged during active use, and protected by idle auto-pause and
          webhook-verified top-ups.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {packages.map((pkg, index) => (
          <Card key={pkg.code} className={index === 1 ? 'border-accent shadow-glow' : ''}>
            <CardHeader>
              {index === 1 ? <Badge tone="accent">Most Popular</Badge> : null}
              <CardTitle className="text-3xl">{pkg.name}</CardTitle>
              <CardDescription>{pkg.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="font-display text-4xl font-semibold">{formatCurrency(pkg.amount, 'USD')}</p>
                <p className="text-sm text-muted-foreground">{formatDuration(pkg.seconds)} of active study time</p>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 text-success" />
                  Session debit in controlled intervals
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 text-success" />
                  Auto-pause when idle
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 text-success" />
                  Pair one or more extension devices
                </li>
              </ul>
              <Button className="w-full">Buy Now</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[32px]">
        <CardHeader>
          <CardTitle>Optional subscription architecture</CardTitle>
          <CardDescription>
            The billing layer is built to support subscriptions later, but the first production path remains one-time
            top-ups with webhook confirmation.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
