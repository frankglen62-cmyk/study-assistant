import type { ReactNode } from 'react';

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
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between pb-6">
      <div className="space-y-2">
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-wider text-accent">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-3xl text-foreground">{title}</h2>
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{badge}</span>
          ) : null}
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
