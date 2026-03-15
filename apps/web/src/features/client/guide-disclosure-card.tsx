import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@study-assistant/ui';

export function GuideDisclosureCard({
  id,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group rounded-[28px] border border-border/70 bg-card/80 shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 marker:content-none">
        <div>
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/50 text-muted-foreground transition group-open:rotate-180">
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200')} />
        </div>
      </summary>
      <div className="border-t border-border/60 px-6 py-5">
        {children}
      </div>
    </details>
  );
}
