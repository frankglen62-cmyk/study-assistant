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
    <div className={cn('border-4 border-black bg-surface p-6 shadow-solid-sm', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {icon ? (
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center border-4 border-black bg-accent">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-black uppercase text-black">{title}</p>
              {status}
            </div>
            {description ? (
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-black/60">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
