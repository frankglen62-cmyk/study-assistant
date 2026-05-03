'use client';

import { startTransition, useState } from 'react';
import { Activity, History, Pause, Play, Square, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { formatDuration } from '@study-assistant/shared-utils';
import type { ClientSessionMutationResponse, DetectionMode, SessionStatus } from '@study-assistant/shared-types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

import { StatusBadge } from '@/components/status-badge';
import { useToast } from '@/components/providers/toast-provider';
import { useLiveSession, type LiveSessionSnapshot } from '@/hooks/use-live-session';

interface SessionManagerProps {
  initialSession: LiveSessionSnapshot | null;
  remainingSeconds: number;
}

function getMutationErrorMessage(
  payload: { error?: string; code?: string } | null,
  fallback: string,
) {
  switch (payload?.code) {
    case 'insufficient_credits':
      return 'At least one minute of credits is required before you can start or resume a session.';
    case 'wallet_locked':
      return 'Your wallet is locked. Contact support or an administrator.';
    case 'session_not_found':
      return 'No open session was found. Start a new session first.';
    case 'daily_usage_limit_reached':
      return 'The account already reached its daily usage limit.';
    case 'monthly_usage_limit_reached':
      return 'The account already reached its monthly usage limit.';
    default:
      return payload?.error ?? fallback;
  }
}

export function SessionManager({ initialSession, remainingSeconds }: SessionManagerProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pendingAction, setPendingAction] = useState<'start' | 'pause' | 'resume' | 'end' | null>(null);

  // Live polling — session and credits update every 5s from the server
  const live = useLiveSession({
    initialSession,
    initialRemainingSeconds: remainingSeconds,
    intervalMs: 5000,
  });

  const session = live.session;
  const creditsRemaining = live.displayRemainingSeconds;
  const isActive = session?.status === 'active';
  const isPaused = session?.status === 'paused';
  const lowCredits = creditsRemaining > 0 && creditsRemaining < 15 * 60;

  async function runMutation(action: 'start' | 'pause' | 'resume' | 'end') {
    const endpointMap = {
      start: '/api/client/sessions/start',
      pause: '/api/client/sessions/pause',
      resume: '/api/client/sessions/resume',
      end: '/api/client/sessions/end',
    } as const;

    startTransition(() => {
      void (async () => {
        setPendingAction(action);

        try {
          const response = await fetch(endpointMap[action], {
            method: 'POST',
          });
          const payload = (await response.json()) as
            | ClientSessionMutationResponse
            | { error?: string; code?: string };

          if (!response.ok) {
            throw new Error(
              getMutationErrorMessage(
                payload as { error?: string; code?: string },
                'Session update failed.',
              ),
            );
          }

          pushToast({
            tone: 'success',
            title:
              action === 'start'
                ? 'Session started'
                : action === 'pause'
                  ? 'Session paused'
                  : action === 'resume'
                    ? 'Session resumed'
                    : 'Session ended',
            description: 'Syncing live status...',
          });

          // Immediately poll to pick up the change
          await live.poll();
          router.refresh();
        } catch (error) {
          pushToast({
            tone: 'danger',
            title: 'Session update failed',
            description:
              error instanceof Error
                ? error.message
                : 'Unable to update the session right now.',
          });
        } finally {
          setPendingAction(null);
        }
      })();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {session ? (
          <>
            {isActive ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void runMutation('pause')}
                disabled={pendingAction !== null}
              >
                <Pause className="h-4 w-4" />{' '}
                {pendingAction === 'pause' ? 'Pausing...' : 'Pause'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => void runMutation('resume')}
                disabled={pendingAction !== null}
              >
                <Play className="h-4 w-4" />{' '}
                {pendingAction === 'resume' ? 'Resuming...' : 'Resume'}
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              onClick={() => void runMutation('end')}
              disabled={pendingAction !== null}
            >
              <Square className="h-4 w-4" />{' '}
              {pendingAction === 'end' ? 'Ending...' : 'End Session'}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => void runMutation('start')}
            disabled={pendingAction !== null}
          >
            <Play className="h-4 w-4" />{' '}
            {pendingAction === 'start' ? 'Starting...' : 'Start New Session'}
          </Button>
        )}
      </div>

      <Card className={session ? 'border-accent/40 ring-1 ring-accent/20' : ''}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity
                  className={
                    session
                      ? 'h-5 w-5 animate-pulse text-accent'
                      : 'h-5 w-5 text-muted-foreground/40'
                  }
                />
                Active Session
              </CardTitle>
              <CardDescription>Current real-time study activity.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lowCredits ? <StatusBadge status="no_credit" /> : null}
              <StatusBadge status={session?.status ?? 'ended'} />
              {live.lastSyncedAt && (
                <span className="text-[10px] text-muted-foreground/60">
                  Live • {new Date(live.lastSyncedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/40 bg-surface/30 p-6">
            {session ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Session ID</p>
                  <p className="font-mono text-lg font-semibold text-foreground">
                    {session.id.split('-')[0]}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Started</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(session.startTime).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Detection mode</p>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {session.detectionMode}
                  </p>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" /> Credits remaining
                  </p>
                  <p className="font-display text-2xl text-foreground">
                    {formatDuration(creditsRemaining)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <History className="mb-4 h-12 w-12 text-muted-foreground/20" />
                <p className="font-display text-xl text-foreground">No active session</p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Start a session here or via the Chrome extension to begin tracking your study
                  time.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/40 bg-surface/50 px-3 py-1.5">
                    Credits available: {formatDuration(creditsRemaining)}
                  </span>
                  {lowCredits ? (
                    <span className="rounded-full border border-red-200 bg-red-50 text-red-700 px-3 py-1.5">
                      Low credits. Top up soon.
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
