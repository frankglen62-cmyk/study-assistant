import Link from 'next/link';

import { cn } from '@study-assistant/ui';

export function LogoMark({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href as any} className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-foreground/5">
        <img
          src="/brand/study-assistant-crest.svg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
      </span>
      <span className="font-display text-lg text-foreground">
        Study Assistant
      </span>
    </Link>
  );
}
