import { ArrowUpRight } from 'lucide-react';

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

export function MetricCard({
  label,
  value,
  delta,
  tone = 'accent',
}: {
  label: string;
  value: string;
  delta: string;
  tone?: 'accent' | 'success' | 'warning' | 'neutral';
}) {
  return (
    <Card className="flex flex-col justify-between p-6">
      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">{label}</p>
        <p className="font-display text-5xl font-black tracking-tighter text-black">{value}</p>
      </div>
      <div className="mt-4">
        <div className="inline-flex w-fit items-center border-[3px] border-black bg-accent px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-black shadow-solid-sm">
          <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
          {delta}
        </div>
      </div>
    </Card>
  );
}
