'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { DetectionMode, SessionStatus } from '@study-assistant/shared-types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface LiveSessionSnapshot {
  id: string;
  status: SessionStatus;
  startTime: string;
  detectionMode: DetectionMode;
  usedSeconds: number;
}

interface LiveSessionState {
  /** Current open session from DB (null = no active/paused session). */
  session: LiveSessionSnapshot | null;
  /**
   * Remaining seconds from the LAST server poll.
   * This is the authoritative value — the local countdown only approximates
   * in between polls. Every poll resets this to the real DB value.
   */
  serverRemainingSeconds: number;
  /**
   * Display remaining seconds — decremented locally every second for a
   * smooth countdown on screen. Gets corrected on each poll.
   */
  displayRemainingSeconds: number;
  /** True while a fetch is in flight. */
  isPolling: boolean;
  /** Timestamp of last successful poll, or null if never polled. */
  lastSyncedAt: string | null;
}

interface UseLiveSessionOptions {
  /** Polling interval in ms. Default 5000 (5s). */
  intervalMs?: number;
  /** Initial remaining seconds from SSR. */
  initialRemainingSeconds: number;
  /** Initial session snapshot from SSR (null = no session). */
  initialSession: LiveSessionSnapshot | null;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */
export function useLiveSession({
  intervalMs = 5000,
  initialRemainingSeconds,
  initialSession,
}: UseLiveSessionOptions): LiveSessionState & {
  /** Manually trigger a poll (e.g. after starting a session from webapp). */
  poll: () => Promise<void>;
} {
  const [state, setState] = useState<LiveSessionState>({
    session: initialSession,
    serverRemainingSeconds: initialRemainingSeconds,
    displayRemainingSeconds: initialRemainingSeconds,
    isPolling: false,
    lastSyncedAt: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  /* ---- Server poll ---- */
  const poll = useCallback(async () => {
    if (!mountedRef.current) return;

    setState((prev) => ({ ...prev, isPolling: true }));

    try {
      const res = await fetch('/api/client/sessions/status', {
        cache: 'no-store',
        credentials: 'same-origin',
      });

      if (!res.ok) {
        setState((prev) => ({ ...prev, isPolling: false }));
        return;
      }

      const data = (await res.json()) as {
        session: LiveSessionSnapshot | null;
        remainingSeconds: number;
      };

      if (!mountedRef.current) return;

      setState((prev) => ({
        session: data.session,
        serverRemainingSeconds: data.remainingSeconds,
        // Snap display to server truth on every poll
        displayRemainingSeconds: data.remainingSeconds,
        isPolling: false,
        lastSyncedAt: new Date().toISOString(),
      }));
    } catch {
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, isPolling: false }));
      }
    }
  }, []);

  /* ---- Polling interval (pauses when tab hidden) ---- */
  useEffect(() => {
    mountedRef.current = true;

    function startPolling() {
      // Immediate poll on visibility return
      void poll();
      intervalRef.current = setInterval(() => void poll(), intervalMs);
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    }

    // Start immediately
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs, poll]);

  /* ---- Local countdown (1s tick) for smooth display ---- */
  useEffect(() => {
    // Only count down when session is active
    const isActive = state.session?.status === 'active';

    if (!isActive || state.displayRemainingSeconds <= 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    countdownRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        displayRemainingSeconds: Math.max(0, prev.displayRemainingSeconds - 1),
      }));
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [state.session?.status, state.serverRemainingSeconds]);

  return { ...state, poll };
}
