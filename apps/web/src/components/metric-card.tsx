import { Card } from '@study-assistant/ui';

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
  const toneColor = {
    accent: 'text-accent',
    success: 'text-green-600',
    warning: 'text-amber-600',
    neutral: 'text-muted-foreground',
  }[tone];

  const toneDot = {
    accent: 'bg-accent',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    neutral: 'bg-muted-foreground',
  }[tone];

  return (
    <div className="rounded-2xl border border-border/40 bg-background p-5 shadow-card transition-all duration-300 hover:shadow-card-hover">
      <p className="text-xs font-medium text-muted-foreground mb-3">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className={`mt-3 text-xs font-medium flex items-center gap-1.5 ${toneColor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${toneDot}`} />
        {delta}
      </p>
    </div>
  );
}
