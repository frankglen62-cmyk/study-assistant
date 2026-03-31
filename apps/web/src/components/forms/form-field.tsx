import type { ReactNode } from 'react';

import { cn } from '@study-assistant/ui';

export function FormField({
  label,
  description,
  error,
  children,
}: {
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black">{label}</span>
      {description ? <span className="block text-[10px] font-bold uppercase tracking-widest text-black/60">{description}</span> : null}
      {children}
      <span className={cn('block min-h-5 text-[10px] font-bold uppercase tracking-widest', error ? 'text-danger' : 'text-transparent')}>{error ?? '.'}</span>
    </label>
  );
}
