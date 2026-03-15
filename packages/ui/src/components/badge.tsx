import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

const toneClasses = {
  neutral: 'bg-muted text-muted-foreground',
  accent: 'bg-accent/12 text-accent',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/12 text-danger',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof toneClasses;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium tracking-wide',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
