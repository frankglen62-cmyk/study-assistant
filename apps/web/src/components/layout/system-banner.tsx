import { AlertTriangle, Wrench } from 'lucide-react';

import { cn } from '@study-assistant/ui';

export function SystemBanner({
  message,
  tone = 'info',
}: {
  message: string;
  tone?: 'info' | 'warning';
}) {
  const Icon = tone === 'warning' ? Wrench : AlertTriangle;

  return (
    <div
      className={cn(
        'border-b px-4 py-3 text-sm',
        tone === 'warning'
          ? 'border-amber-300/40 bg-amber-50 text-amber-900'
          : 'border-emerald-300/40 bg-emerald-50 text-emerald-900',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{message}</p>
      </div>
    </div>
  );
}
