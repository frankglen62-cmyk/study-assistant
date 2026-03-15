'use client';

import { startTransition, useState } from 'react';
import { Activity, History, Pause, Play, Square, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { formatDuration } from '@study-assistant/shared-utils';
import type { ClientSessionMutationResponse, DetectionMode, SessionStatus } from '@study-assistant/shared-types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

import { StatusBadge } from '@/components/status-badge';
import { useToast } from '@/components/providers/toast-provider';

interface OpenSessionSnapshot {
  id: string;
  status: SessionStatus;
  startTime: string;
  detectionMode: DetectionMode;
}

interface SessionMutationErrorPayload {
  error?: string;
  code?: string;
}

interface SessionManagerProps {
  initialSession: OpenSessionSnapshot | null;
  remainingSeconds: number;
}

function toPortalStatus(status: ClientSessionMutationResponse['status']): SessionStatus {
  switch (status) {
    case 'session_active':
      return 'active';
    case 'session_paused':
      return 'paused';
    case 'session_inactive':
    case 'session_expired':
      return 'ended';
    default:
      return 'ended';
  }
}

function getMutationErrorMessage(payload: SessionMutationErrorPayload | null, fallback: string) {
  switch (payload?.code) {
    case 'insufficient_credits':
      return 'At least one minute of credits is required before you can start or resume a session.';
    case 'wallet_locked':
      return 'Your wallet is locked. Contact support or an administrator.';
    case 'session_not_found':
      return 'No open session was found. Start a new session first.';
    default:
      return payload?.error ?? fallback;
  }
}

export function SessionManager({ initialSession, remainingSeconds }: SessionManagerProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [session, setSession] = useState<OpenSessionSnapshot | null>(initialSession);
  const [creditsRemaining, setCreditsRemaining] = useState(remainingSeconds);
  const [pendingAction, setPendingAction] = useState<'start' | 'pause' | 'resume' | 'end' | null>(null);

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
          const payload = (await response.json()) as ClientSessionMutationResponse | SessionMutationErrorPayload;

          if (!response.ok) {
            throw new Error(getMutationErrorMessage(payload as SessionMutationErrorPayload, 'Session update failed.'));
          }

          const sessionPayload = payload as ClientSessionMutationResponse;
          const nextStatus = toPortalStatus(sessionPayload.status);
          const nextRemainingSeconds = sessionPayload.remainingSeconds ?? creditsRemaining;
          const existingStartTime = session?.startTime ?? new Date().toISOString();

          setCreditsRemaining(nextRemainingSeconds);

          if (nextStatus === 'ended') {
            setSession(null);
          } else {
            setSession({
              id: sessionPayload.sessionId,
              status: nextStatus,
              startTime: action === 'start' && !session ? new Date().toISOString() : existingStartTime,
              detectionMode: sessionPayload.detectionMode,
            });
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
            description: `Credits remaining: ${formatDuration(nextRemainingSeconds)}.`,
          });

          router.refresh();
        } catch (error) {
          pushToast({
            tone: 'danger',
            title: 'Session update failed',
            description: error instanceof Error ? error.message : 'Unable to update the session right now.',
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
              <Button variant="secondary" className="gap-2" onClick={() => void runMutation('pause')} disabled={pendingAction !== null}>
                <Pause className="h-4 w-4" /> {pendingAction === 'pause' ? 'Pausing...' : 'Pause'}
              </Button>
            ) : (
              <Button className="gap-2" onClick={() => void runMutation('resume')} disabled={pendingAction !== null}>
                <Play className="h-4 w-4" /> {pendingAction === 'resume' ? 'Resuming...' : 'Resume'}
              </Button>
            )}
            <Button variant="danger" className="gap-2" onClick={() => void runMutation('end')} disabled={pendingAction !== null}>
              <Square className="h-4 w-4" /> {pendingAction === 'end' ? 'Ending...' : 'End Session'}
            </Button>
          </>
        ) : (
          <Button className="gap-2" onClick={() => void runMutation('start')} disabled={pendingAction !== null}>
            <Play className="h-4 w-4" /> {pendingAction === 'start' ? 'Starting...' : 'Start New Session'}
          </Button>
        )}
      </div>

      <Card className={session ? 'border-success/50 bg-success/5 shadow-[0_0_30px_-10px_rgba(var(--success),0.2)]' : 'bg-surface/40'}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className={session ? 'h-5 w-5 animate-pulse text-success' : 'h-5 w-5 text-muted-foreground'} />
              Active Session
            </CardTitle>
            <CardDescription className="mt-1">Current real-time study activity.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lowCredits ? <StatusBadge status="no_credit" /> : null}
            <StatusBadge status={session?.status ?? 'ended'} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-[22px] border border-border/50 bg-background/60 p-5">
            {session ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">Session ID</p>
                  <p className="font-mono text-sm">{session.id.split('-')[0]}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">Started</p>
                  <p className="text-sm">{new Date(session.startTime).toLocaleTimeString()}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">Detection mode</p>
                  <p className="text-sm capitalize">{session.detectionMode}</p>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" /> Credits remaining
                  </p>
                  <p className="text-sm">{formatDuration(creditsRemaining)}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <History className="mb-3 h-8 w-8 text-muted-foreground opacity-50" />
                <p className="text-sm font-medium text-foreground">No active session</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Start a session here or via the Chrome extension to begin tracking your study time.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Credits available: {formatDuration(creditsRemaining)}</span>
                  {lowCredits ? <span>Low credits. Top up soon.</span> : null}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
