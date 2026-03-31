'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { Clock3, Copy, Download, RefreshCw, ShieldCheck, Zap } from 'lucide-react';

import type { ExtensionPairingCodeResponse } from '@study-assistant/shared-types';

import { useToast } from '@/components/providers/toast-provider';
import { extensionDownloadFileName, extensionDownloadPath, extensionVersion } from '@/lib/extension-distribution';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@study-assistant/ui';

interface PairExtensionCardProps {
  cardId?: string;
  appBaseUrl: string;
  initialDeviceName?: string;
  title?: string;
  description?: string;
  pairedDeviceCount?: number;
  latestInstalledVersion?: string | null;
}

export function PairExtensionCard({
  cardId,
  appBaseUrl,
  initialDeviceName = 'My Study Device',
  title = 'Pairing mode',
  description = 'Generate a short-lived code and use it right away in the extension onboarding screen.',
  pairedDeviceCount = 0,
  latestInstalledVersion = null,
}: PairExtensionCardProps) {
  const { pushToast } = useToast();
  const [deviceName, setDeviceName] = useState(initialDeviceName);
  const [pending, setPending] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

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
    if (secondsRemaining === null) {
      return null;
    }

    if (secondsRemaining === 0) {
      return 'Expired';
    }

    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
  }, [secondsRemaining]);

  const pairingState = pairedDeviceCount > 0 ? 'Paired' : 'Ready to pair';
  const installedBuildLabel = latestInstalledVersion ? latestInstalledVersion : 'Not detected yet';
  const hasPairingCode = Boolean(pairingCode);

  function handleGenerateCode() {
    startTransition(() => {
      void (async () => {
        setPending(true);

        try {
          const response = await fetch('/api/auth/extension/pair', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              deviceName: deviceName.trim() || undefined,
            }),
          });

          const payload = (await response.json()) as Partial<ExtensionPairingCodeResponse> & { error?: string };
          if (!response.ok || !payload.pairingCode || !payload.expiresAt) {
            throw new Error(payload.error ?? 'Pairing code generation failed.');
          }

          setPairingCode(payload.pairingCode);
          setExpiresAt(payload.expiresAt);

          try {
            await navigator.clipboard.writeText(payload.pairingCode);
          } catch {
            // Clipboard auto-copy is best effort only.
          }

          pushToast({
            tone: 'success',
            title: 'Pairing code ready',
            description: 'The code was generated and copied. Paste it into the extension onboarding screen before it expires.',
          });
        } catch (error) {
          pushToast({
            tone: 'danger',
            title: 'Pairing failed',
            description: error instanceof Error ? error.message : 'Pairing code generation failed.',
          });
        } finally {
          setPending(false);
        }
      })();
    });
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({
        tone: 'success',
        title: `${label} copied`,
      });
    } catch {
      pushToast({
        tone: 'warning',
        title: `Unable to copy ${label.toLowerCase()}`,
        description: 'Copy it manually from the field.',
      });
    }
  }

  return (
    <Card
      id={cardId}
      className="overflow-hidden border-accent/30 ring-1 ring-accent/10 bg-gradient-to-br from-accent/5 via-emerald-50/30 to-transparent"
    >
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Pairing Mode
              </Badge>
              <Badge tone={pairedDeviceCount > 0 ? 'success' : 'warning'}>
                {pairedDeviceCount > 0
                  ? `${pairedDeviceCount} paired ${pairedDeviceCount === 1 ? 'device' : 'devices'}`
                  : 'No paired browser yet'}
              </Badge>
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-1">
                {description}{' '}
                {pairedDeviceCount > 0
                  ? 'Use this when you want to add another browser or reconnect the current one.'
                  : 'Open the extension onboarding screen first, then generate and paste the code immediately.'}
              </CardDescription>
            </div>
          </div>

          <Button asChild variant="secondary" size="sm">
            <a href={extensionDownloadPath} download={extensionDownloadFileName}>
              <Download className="h-4 w-4" />
              Download ZIP
            </a>
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-white p-5">
            <p className="text-xs font-medium text-muted-foreground">Pairing status</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{pairingState}</p>
          </div>
          <div className="rounded-xl border border-foreground/10 bg-foreground p-5">
            <p className="text-xs font-medium text-white/60">Current ZIP build</p>
            <p className="mt-2 text-xl font-semibold text-accent">v{extensionVersion}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-white p-5">
            <p className="text-xs font-medium text-muted-foreground">Installed on latest browser</p>
            <p className="mt-2 text-xl font-semibold text-foreground break-words">{installedBuildLabel}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-0">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-border/40 bg-white p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">App URL</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => void copyValue(appBaseUrl, 'App URL')}>
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <Input value={appBaseUrl} readOnly className="font-mono text-sm bg-surface/50" />
              <p className="mt-3 text-xs text-muted-foreground">
                Use this exact portal host inside the extension so pairing and API calls stay on the trusted origin.
              </p>
            </div>

            <div className="rounded-xl border border-border/40 bg-white p-5">
              <p className="mb-3 text-sm font-medium text-foreground">Device name</p>
              <Input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={120} />
              <p className="mt-3 text-xs text-muted-foreground">
                Give this browser a clear name so you can revoke the correct device later.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex flex-col justify-between">
            <div className="flex flex-col items-start gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-800">Current pairing code</p>
                <p className="mt-1 text-xs text-amber-700">
                  Generate only when the extension onboarding screen is open.
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-4">
                {countdownLabel ? (
                  <Badge tone={isExpired ? 'danger' : secondsRemaining !== null && secondsRemaining < 90 ? 'danger' : 'accent'}>
                    <Clock3 className="h-3.5 w-3.5" />
                    {countdownLabel}
                  </Badge>
                ) : <div />}
                <Button type="button" size="sm" onClick={handleGenerateCode} disabled={pending}>
                  {pending ? (
                    'Generating...'
                  ) : pairingCode ? (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="relative mt-6 rounded-xl border border-border/40 bg-white p-5 pr-16">
              <p
                className={[
                  'font-mono font-semibold',
                  hasPairingCode
                    ? 'break-all text-2xl tracking-wider text-foreground'
                    : 'text-base text-muted-foreground/40',
                ].join(' ')}
              >
                {pairingCode ?? 'Not generated yet'}
              </p>
              <button
                type="button"
                aria-label="Copy pairing code"
                title={hasPairingCode ? 'Copy pairing code' : 'Generate a code first'}
                disabled={!hasPairingCode}
                onClick={() => pairingCode ? void copyValue(pairingCode, 'Pairing code') : undefined}
                className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-accent/10 text-accent transition-all hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-xs text-amber-700">
              {expiresAt
                ? `Expires ${new Date(expiresAt).toLocaleString()}. ${isExpired ? 'Generate a fresh code before pairing.' : 'The newest code was copied automatically.'}`
                : 'After you generate a code, paste it immediately into the extension together with the app URL and device name.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
