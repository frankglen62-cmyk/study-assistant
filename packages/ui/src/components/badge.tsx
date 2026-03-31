import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

const toneClasses = {
  neutral: 'bg-surface text-foreground border-2 border-border',
  accent: 'bg-accent text-black border-2 border-current',
  success: 'bg-success text-white border-2 border-current',
  warning: 'bg-warning text-black border-2 border-current',
  danger: 'bg-danger text-white border-2 border-current',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof toneClasses;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-none px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
