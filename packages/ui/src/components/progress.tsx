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
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-background/50 shadow-inner', className)}
      aria-hidden="true"
      {...props}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent/80 to-accent shadow-[0_0_12px_rgba(var(--accent),0.5)] transition-[width] duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative overflow-hidden"
        style={{ width: `${percentage}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] animate-[shimmer_2s_infinite]" />
      </div>
    </div>
  );
}
