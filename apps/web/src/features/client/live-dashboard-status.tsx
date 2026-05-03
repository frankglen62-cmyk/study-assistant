'use client';

import { Activity, Zap } from 'lucide-react';
import { cn } from '@study-assistant/ui';
import { formatDuration } from '@study-assistant/shared-utils';

import { useLiveSession, type LiveSessionSnapshot } from '@/hooks/use-live-session';

interface LiveDashboardStatusProps {
  initialRemainingSeconds: number;
  initialSessionStatus: string;
}

export function LiveDashboardStatus({
  initialRemainingSeconds,
  initialSessionStatus,
}: LiveDashboardStatusProps) {
  const live = useLiveSession({
    initialRemainingSeconds,
    initialSession: null,
    intervalMs: 5000,
  });

  const sessionStatus = live.session?.status ?? initialSessionStatus;
  const displaySeconds = live.displayRemainingSeconds;
  const isActive = sessionStatus === 'active';

  return (
    <div className="rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
          <Activity className={cn('h-5 w-5', isActive ? 'text-accent animate-pulse' : 'text-muted-foreground')} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Session Status</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isActive && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
              )}
              <span
                className={cn(
                  'relative inline-flex h-full w-full rounded-full',
                  isActive ? 'bg-accent' : 'bg-muted-foreground/40',
                )}
              />
            </span>
            <p className="text-sm font-medium text-foreground capitalize">
              {sessionStatus.replace('_', ' ')}
            </p>
            {live.lastSyncedAt && (
              <span className="text-[10px] text-muted-foreground/50">
                Live
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live remaining time */}
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-accent" />
        <span className="font-display text-xl font-semibold text-foreground">
          {formatDuration(displaySeconds)}
        </span>
        <span className="text-xs text-muted-foreground">remaining</span>
      </div>
    </div>
  );
}
