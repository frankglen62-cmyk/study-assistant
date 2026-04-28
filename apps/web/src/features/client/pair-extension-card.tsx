'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock3,
  Copy,
  CopyCheck,
  Download,
  Laptop,
  Link2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import type { ExtensionPairingCodeResponse } from '@study-assistant/shared-types';

import { useToast } from '@/components/providers/toast-provider';
import {
  extensionDownloadFileName,
  extensionDownloadPath,
  extensionVersion,
} from '@/lib/extension-distribution';
import { Badge, Button, Input } from '@study-assistant/ui';

interface PairExtensionCardProps {
  cardId?: string;
  appBaseUrl: string;
  initialDeviceName?: string;
  title?: string;
  description?: string;
  pairedDeviceCount?: number;
  latestInstalledVersion?: string | null;
  simplified?: boolean;
  autoGenerateOnMount?: boolean;
}

const PAIRING_CODE_LIFETIME_SECONDS = 300;

function getBrowserName() {
  if (typeof window === 'undefined') return 'My Study Device';
  const ua = window.navigator.userAgent;
  let browser = 'Chrome';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Brave/')) browser = 'Brave';
  else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';

  let os = 'Device';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} (${os})`;
}

export function PairExtensionCard({
  cardId,
  appBaseUrl,
  initialDeviceName,
  title = 'Pairing Mode',
  description = 'Generate a short-lived code and use it in the extension onboarding screen.',
  pairedDeviceCount = 0,
  latestInstalledVersion = null,
  simplified = false,
  autoGenerateOnMount = false,
}: PairExtensionCardProps) {
  const { pushToast } = useToast();
  const [deviceName, setDeviceName] = useState(initialDeviceName ?? 'My Study Device');
  const [pending, setPending] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const autoGenerateTriggered = useRef(false);

  useEffect(() => {
    if (!initialDeviceName) {
      setDeviceName(getBrowserName());
    }
  }, [initialDeviceName]);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsRemaining(null);
      return;
    }

    const expiryMs = new Date(expiresAt).getTime();

    function updateRemaining() {
      const seconds = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      setSecondsRemaining(seconds);
    }

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [expiresAt]);

  const isExpired = secondsRemaining === 0 && pairingCode !== null;
  const countdownLabel = useMemo(() => {
    if (secondsRemaining === null) return null;
    if (secondsRemaining === 0) return 'Expired';
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [secondsRemaining]);

  const hasPairingCode = Boolean(pairingCode);

  function handleGenerateCode() {
    startTransition(() => {
      void (async () => {
        setPending(true);
        try {
          const response = await fetch('/api/auth/extension/pair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceName: deviceName.trim() || undefined }),
          });
          const payload = (await response.json()) as Partial<ExtensionPairingCodeResponse> & {
            error?: string;
          };
          if (!response.ok || !payload.pairingCode || !payload.expiresAt) {
            throw new Error(payload.error ?? 'Pairing code generation failed.');
          }
          setPairingCode(payload.pairingCode);
          setExpiresAt(payload.expiresAt);
          try {
            await navigator.clipboard.writeText(payload.pairingCode);
          } catch {
            /* best effort */
          }
          pushToast({
            tone: 'success',
            title: 'Pairing code generated & copied',
            description: 'Paste it into the extension onboarding screen.',
          });
        } catch (error) {
          pushToast({
            tone: 'danger',
            title: 'Pairing failed',
            description: error instanceof Error ? error.message : 'Failed.',
          });
        } finally {
          setPending(false);
        }
      })();
    });
  }

  useEffect(() => {
    if (!autoGenerateOnMount || autoGenerateTriggered.current || hasPairingCode || pending) {
      return;
    }
    autoGenerateTriggered.current = true;
    handleGenerateCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateOnMount]);

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ tone: 'success', title: `${label} copied` });
    } catch {
      pushToast({ tone: 'warning', title: `Unable to copy`, description: 'Copy it manually.' });
    }
  }

  async function handleCopyAll() {
    if (!pairingCode) return;
    const block = `App URL: ${appBaseUrl}\nDevice Name: ${deviceName}\nPairing Code: ${pairingCode}`;
    try {
      await navigator.clipboard.writeText(block);
      pushToast({
        tone: 'success',
        title: `All pairing details copied`,
        description: 'Paste them anywhere you need.',
      });
    } catch {
      pushToast({ tone: 'warning', title: `Unable to copy`, description: 'Copy them manually.' });
    }
  }

  const versionMatches = latestInstalledVersion === extensionVersion;
  const counterLabel =
    pairedDeviceCount > 0
      ? `${pairedDeviceCount} of your browser${pairedDeviceCount === 1 ? '' : 's'} paired`
      : 'No browser paired yet';

  return (
    <div
      id={cardId}
      className="rounded-2xl border border-border/40 bg-background shadow-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <Link2 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge tone={pairedDeviceCount > 0 ? 'success' : 'warning'}>{counterLabel}</Badge>
      </div>

      <div className="space-y-6 p-6">
        {/* Highlighted Pairing Code Section */}
        <div
          className={`relative overflow-hidden rounded-xl border p-5 transition-colors ${
            hasPairingCode
              ? isExpired
                ? 'border-red-200 bg-red-50/40 dark:border-red-500/30 dark:bg-red-500/10'
                : 'border-accent/40 bg-accent/5'
              : 'border-border/40 bg-surface/50 dark:bg-surface'
          }`}
        >
          {hasPairingCode && !isExpired && (
            <div className="absolute left-0 top-0 h-1 w-full overflow-hidden bg-accent/20">
              <div
                className="h-full bg-accent transition-all duration-1000 ease-linear"
                style={{
                  width: `${Math.max(0, ((secondsRemaining ?? 0) / PAIRING_CODE_LIFETIME_SECONDS) * 100)}%`,
                }}
              />
            </div>
          )}

          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p
                className={`text-sm font-bold ${
                  hasPairingCode && !isExpired ? 'text-accent' : 'text-foreground'
                }`}
              >
                Pairing code
              </p>
              {countdownLabel ? (
                <p
                  className={`mt-0.5 flex items-center gap-1 text-[11px] font-medium ${
                    isExpired ? 'text-red-500' : 'text-accent/80'
                  }`}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {isExpired ? 'Expired — generate a fresh one.' : `Expires in ${countdownLabel}`}
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {pending
                    ? 'Generating a fresh code…'
                    : 'A short-lived code will appear here. Paste it into the extension.'}
                </p>
              )}
            </div>
            <Button type="button" size="sm" onClick={handleGenerateCode} disabled={pending}>
              {pending ? (
                'Generating…'
              ) : pairingCode ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" /> Generate code
                </>
              )}
            </Button>
          </div>

          <div className="relative rounded-xl border border-border/40 bg-background px-4 py-3 pr-12 shadow-sm">
            <p
              className={`font-mono ${
                hasPairingCode
                  ? 'text-xl font-bold tracking-[0.15em] text-foreground'
                  : 'text-sm font-medium tracking-normal text-muted-foreground/40'
              }`}
            >
              {pairingCode ?? 'XXXX-XXXX-XXXX-XXXX'}
            </p>
            {hasPairingCode && (
              <button
                type="button"
                onClick={() => pairingCode && void copyValue(pairingCode, 'Pairing code')}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-accent/10 text-accent transition-all hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                title="Copy pairing code"
                aria-label="Copy pairing code"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Setup Details */}
        {!simplified && (
          <div className="grid gap-5 pt-2 md:grid-cols-2">
            {/* App URL */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> App URL
              </label>
              <Input
                value={appBaseUrl}
                readOnly
                className="h-9 border-border/40 bg-surface/30 font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>

            {/* Device name */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Laptop className="h-3.5 w-3.5 text-muted-foreground" /> Device name
              </label>
              <Input
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                maxLength={120}
                className="h-9 border-border/40 text-sm"
              />
            </div>
          </div>
        )}

        {/* Master Action Row */}
        <div className="flex flex-col gap-3 border-t border-border/30 pt-4 sm:flex-row">
          {!simplified && (
            <Button
              type="button"
              className="flex-1"
              disabled={!hasPairingCode}
              onClick={handleCopyAll}
            >
              {hasPairingCode ? <CopyCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy all pairing details
            </Button>
          )}
          <Button
            asChild
            variant={simplified ? 'secondary' : 'ghost'}
            size="sm"
            className={simplified ? 'w-full' : 'flex-1'}
          >
            <a href={extensionDownloadPath} download={extensionDownloadFileName}>
              <Download className="h-4 w-4" />
              Re-download ZIP v{extensionVersion}
            </a>
          </Button>
        </div>

        {!simplified && latestInstalledVersion ? (
          <p className="text-[11px] text-muted-foreground">
            Latest installed browser is on{' '}
            <span className="font-mono">v{latestInstalledVersion}</span>
            {versionMatches ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                {' '}
                · matches the current ZIP.
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400"> · behind the current ZIP.</span>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
