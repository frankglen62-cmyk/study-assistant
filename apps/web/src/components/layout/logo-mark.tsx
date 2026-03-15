import Link from 'next/link';

import { cn } from '@study-assistant/ui';

export function LogoMark({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href as any} className={cn('inline-flex items-center gap-3', className)}>
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-background/80 shadow-glow">
        <img
          src="/brand/study-assistant-crest.svg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
      </span>
      <span className="flex flex-col">
        <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Study Assistant
        </span>
        <span className="text-sm text-muted-foreground">Admin-managed private retrieval</span>
      </span>
    </Link>
  );
}
