'use client';

import { useEffect, useRef, useState } from 'react';

import { env } from '@/lib/env/client';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          theme?: 'light' | 'dark' | 'auto';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = 'study-assistant-turnstile';
let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    if (window.turnstile) {
      resolve();
      return;
    }

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Turnstile.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Turnstile.'));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

type CaptchaWidgetProps = {
  action: string;
  resetKey: number;
  error?: string | null;
  onTokenChange: (token: string | null) => void;
};

export function CaptchaWidget({ action, resetKey, error, onTokenChange }: CaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onTokenChange(null);

    if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    container.innerHTML = '';

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
          action,
          theme: 'light',
          callback: (token) => {
            onTokenChange(token);
            setIsLoading(false);
            setLoadError(null);
          },
          'expired-callback': () => {
            onTokenChange(null);
          },
          'error-callback': () => {
            onTokenChange(null);
            setLoadError('Security check could not load. Refresh and try again.');
            setIsLoading(false);
          },
        });

        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        onTokenChange(null);
        setLoadError('Security check could not load. Refresh and try again.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onTokenChange, resetKey]);

  if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return null;
  }

  return (
    <div className="space-y-2 text-center">
      <div className="flex min-h-[65px] items-center justify-center">
        <div ref={containerRef} className="mx-auto" />
      </div>
      {isLoading ? <p className="text-xs text-neutral-500">Loading security check…</p> : null}
      {loadError ? <p className="text-xs text-red-400">{loadError}</p> : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
