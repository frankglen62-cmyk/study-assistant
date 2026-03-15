'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

import { useToast } from '@/components/providers/toast-provider';
import { cn } from '@study-assistant/ui';

const toneMap = {
  info: {
    icon: Info,
    className: 'border-border bg-surface text-surface-foreground',
  },
  success: {
    icon: CircleCheck,
    className: 'border-success/30 bg-success/10 text-success',
  },
  warning: {
    icon: CircleAlert,
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  danger: {
    icon: CircleAlert,
    className: 'border-danger/30 bg-danger/10 text-danger',
  },
} as const;

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const tone = toneMap[toast.tone ?? 'info'];
        const Icon = tone.icon;

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto rounded-[22px] border p-4 shadow-lg backdrop-blur',
              tone.className,
            )}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground transition hover:bg-background/50 hover:text-foreground"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
