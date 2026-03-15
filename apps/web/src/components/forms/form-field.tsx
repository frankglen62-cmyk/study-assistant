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
      <span className="text-sm font-medium text-foreground">{label}</span>
      {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      {children}
      <span className={cn('block min-h-5 text-xs', error ? 'text-danger' : 'text-transparent')}>{error ?? '.'}</span>
    </label>
  );
}
