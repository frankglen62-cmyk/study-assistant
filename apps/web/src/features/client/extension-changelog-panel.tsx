import { ChevronRight, Sparkles } from 'lucide-react';

import { extensionChangelog } from '@/lib/extension-changelog';

export function ExtensionChangelogPanel({ className = '' }: { className?: string }) {
  const [latest, ...older] = extensionChangelog;
  if (!latest) {
    return null;
  }

  return (
    <details
      className={`group rounded-2xl border border-border/40 bg-background shadow-card ${className}`}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 text-sm font-medium text-foreground">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          What&apos;s new in v{latest.version}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-4 border-t border-border/40 px-6 py-5 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            v{latest.version} · {latest.date}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground">
            {latest.highlights.map((item) => (
              <li key={item} className="text-sm">
                {item}
              </li>
            ))}
          </ul>
        </div>
        {older.length > 0 ? (
          <div className="space-y-3 border-t border-border/30 pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Older versions
            </p>
            {older.map((entry) => (
              <div key={entry.version}>
                <p className="text-xs font-medium text-muted-foreground">
                  v{entry.version} · {entry.date}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {entry.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}
