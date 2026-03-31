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
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b-4 border-black pb-8">
      <div className="space-y-4">
        {eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="font-display text-5xl font-black uppercase tracking-tighter text-black">{title}</h2>
          {badge ? <Badge tone="accent">{badge}</Badge> : null}
        </div>
        <p className="max-w-3xl text-sm font-bold uppercase tracking-widest text-black/60">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
