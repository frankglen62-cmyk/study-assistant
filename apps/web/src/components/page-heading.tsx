import type { ReactNode } from 'react';
import { Badge } from '@study-assistant/ui';

export function PageHeading({
  eyebrow,
  title,
  description,
  badge,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? <p className="text-sm uppercase tracking-[0.18em] text-accent">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-3xl font-semibold tracking-tight">{title}</h2>
          {badge ? <Badge tone="accent">{badge}</Badge> : null}
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
