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
    <Card className="relative overflow-hidden group">
      {/* Subtle background glow effect appearing on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <CardHeader className="relative z-10 pb-2">
        <CardDescription className="uppercase tracking-wider text-xs font-semibold text-muted-foreground/80">{label}</CardDescription>
        <CardTitle className="text-4xl font-display font-bold tracking-tight text-foreground drop-shadow-sm">{value}</CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 mt-2">
        <Badge tone={tone} className="gap-1.5 px-2 bg-background/50 border-white/5 shadow-sm">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {delta}
        </Badge>
      </CardContent>
    </Card>
  );
}
