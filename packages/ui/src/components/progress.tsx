import type { HTMLAttributes } from 'react';

import { clamp } from '@study-assistant/shared-utils';

import { cn } from '../lib/cn';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
}

export function Progress({ className, value, ...props }: ProgressProps) {
  const percentage = clamp(value, 0, 100);

  return (
    <div
      className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-muted/60', className)}
      aria-hidden="true"
      {...props}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
