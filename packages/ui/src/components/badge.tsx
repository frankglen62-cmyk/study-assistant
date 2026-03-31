import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

const toneClasses = {
  neutral: 'bg-muted/60 text-foreground',
  accent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  success: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof toneClasses;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
