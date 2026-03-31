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
      className={cn('relative h-4 w-full overflow-hidden rounded-none border-4 border-black bg-background shadow-solid-sm', className)}
      aria-hidden="true"
      {...props}
    >
      <div
        className="h-full rounded-none bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative overflow-hidden border-r-4 border-black"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
