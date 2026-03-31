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
      className="overflow-hidden border-4 border-black bg-accent p-0 shadow-solid-md"
    >
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent" className="gap-1.5 border-black text-black">
                <Zap className="h-4 w-4" />
                Pairing Mode
              </Badge>
              <Badge tone={pairedDeviceCount > 0 ? 'success' : 'warning'} className="border-black">
                {pairedDeviceCount > 0
                  ? `${pairedDeviceCount} paired ${pairedDeviceCount === 1 ? 'device' : 'devices'}`
                  : 'No paired browser yet'}
              </Badge>
            </div>
            <div>
              <CardTitle className="font-display text-4xl font-black uppercase text-black">{title}</CardTitle>
              <CardDescription className="text-black/80 font-bold uppercase tracking-widest text-xs mt-2">
                {description}{' '}
                {pairedDeviceCount > 0
                  ? 'Use this when you want to add another browser or reconnect the current one.'
                  : 'Open the extension onboarding screen first, then generate and paste the code immediately.'}
              </CardDescription>
            </div>
          </div>

          <Button asChild variant="secondary" className="gap-2 border-4 border-black font-black uppercase tracking-widest text-black bg-surface hover:bg-black hover:text-white rounded-none">
            <a href={extensionDownloadPath} download={extensionDownloadFileName}>
              <Download className="h-5 w-5" />
              Download ZIP
            </a>
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-black/60">Pairing status</p>
            <p className="mt-2 text-2xl font-black uppercase text-black">{pairingState}</p>
          </div>
          <div className="border-4 border-black bg-black p-6 shadow-solid-sm">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white/60">Current ZIP build</p>
            <p className="mt-2 text-2xl font-black uppercase text-accent">v{extensionVersion}</p>
          </div>
          <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-black/60">Installed on latest browser</p>
            <p className="mt-2 text-2xl font-black uppercase text-black break-words">{installedBuildLabel}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-0 bg-accent">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-black">App URL</p>
                <Button type="button" variant="ghost" size="sm" className="h-10 px-4 border-2 border-black font-black uppercase tracking-widest hover:bg-black hover:text-white" onClick={() => void copyValue(appBaseUrl, 'App URL')}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>
              <Input value={appBaseUrl} readOnly className="font-mono text-sm bg-black/5" />
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-black/60">
                Use this exact portal host inside the extension so pairing and API calls stay on the trusted origin.
              </p>
            </div>

            <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
              <p className="mb-4 text-[10px] uppercase font-black tracking-[0.2em] text-black">Device name</p>
              <Input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={120} className="bg-black/5" />
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-black/60">
                Give this browser a clear name so you can revoke the correct device later.
              </p>
            </div>
          </div>

          <div className="border-4 border-black bg-warning p-6 shadow-solid-md flex flex-col justify-between">
            <div className="flex flex-col items-start gap-4">
              <div>
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-black">Current pairing code</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-black/80">
                  Generate only when the extension onboarding screen is open.
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-4">
                {countdownLabel ? (
                  <Badge tone={isExpired ? 'danger' : secondsRemaining !== null && secondsRemaining < 90 ? 'danger' : 'accent'} className="border-black shadow-solid-sm py-2">
                    <Clock3 className="h-4 w-4" />
                    {countdownLabel}
                  </Badge>
                ) : <div />}
                <Button type="button" onClick={handleGenerateCode} disabled={pending} className="gap-2 bg-black text-white hover:bg-white hover:text-black hover:border-black font-black uppercase">
                  {pending ? (
                    'Generating...'
                  ) : pairingCode ? (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-5 w-5" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="relative mt-8 border-4 border-black bg-white p-6 pr-20 shadow-solid-sm">
              <p
                className={[
                  'font-mono font-black uppercase',
                  hasPairingCode
                    ? 'break-all text-3xl tracking-widest text-black'
                    : 'text-base tracking-widest text-black/30',
                ].join(' ')}
              >
                {pairingCode ?? 'NOT GENERATED YET'}
              </p>
              <button
                type="button"
                aria-label="Copy pairing code"
                title={hasPairingCode ? 'Copy pairing code' : 'Generate a code first'}
                disabled={!hasPairingCode}
                onClick={() => pairingCode ? void copyValue(pairingCode, 'Pairing code') : undefined}
                className="absolute right-4 top-1/2 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center border-4 border-black bg-accent text-black transition-all hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 hover:-translate-y-[calc(50%+2px)] hover:translate-x-[2px] hover:shadow-none shadow-solid-sm"
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-black/70">
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
