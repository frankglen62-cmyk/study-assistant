import type { ReactNode } from 'react';

import { cn } from '@study-assistant/ui';

export function SettingRow({
  icon,
  title,
  description,
  status,
  action,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  status?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-border/50 bg-background/30 p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon ? (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{title}</p>
              {status}
            </div>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
