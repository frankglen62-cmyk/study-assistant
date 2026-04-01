'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { Clock3, Copy, Download, RefreshCw, ShieldCheck, Link2 } from 'lucide-react';

import type { ExtensionPairingCodeResponse } from '@study-assistant/shared-types';

import { useToast } from '@/components/providers/toast-provider';
import { extensionDownloadFileName, extensionDownloadPath, extensionVersion } from '@/lib/extension-distribution';
import { Badge, Button, Input } from '@study-assistant/ui';

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
  title = 'Pairing Mode',
  description = 'Generate a short-lived code and use it in the extension onboarding screen.',
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
          const payload = (await response.json()) as Partial<ExtensionPairingCodeResponse> & { error?: string };
          if (!response.ok || !payload.pairingCode || !payload.expiresAt) {
            throw new Error(payload.error ?? 'Pairing code generation failed.');
          }
          setPairingCode(payload.pairingCode);
          setExpiresAt(payload.expiresAt);
          try { await navigator.clipboard.writeText(payload.pairingCode); } catch { /* best effort */ }
          pushToast({ tone: 'success', title: 'Pairing code ready', description: 'Paste it into the extension onboarding screen.' });
        } catch (error) {
          pushToast({ tone: 'danger', title: 'Pairing failed', description: error instanceof Error ? error.message : 'Failed.' });
        } finally {
          setPending(false);
        }
      })();
    });
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ tone: 'success', title: `${label} copied` });
    } catch {
      pushToast({ tone: 'warning', title: `Unable to copy`, description: 'Copy it manually.' });
    }
  }

  return (
    <div id={cardId} className="rounded-2xl border border-border/40 bg-white shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <Link2 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <Badge tone={pairedDeviceCount > 0 ? 'success' : 'warning'}>
          {pairedDeviceCount > 0 ? `${pairedDeviceCount} paired` : 'Not paired'}
        </Badge>
      </div>

      <div className="p-6 space-y-5">
        {/* Status row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/40 bg-surface/30 p-3.5 text-center">
            <p className="text-[11px] font-medium text-muted-foreground">Status</p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">{pairedDeviceCount > 0 ? 'Paired' : 'Ready'}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-surface/30 p-3.5 text-center">
            <p className="text-[11px] font-medium text-muted-foreground">ZIP Build</p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">v{extensionVersion}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-surface/30 p-3.5 text-center">
            <p className="text-[11px] font-medium text-muted-foreground">Installed</p>
            <p className="mt-1.5 text-sm font-semibold text-foreground truncate">{latestInstalledVersion ?? '—'}</p>
          </div>
        </div>

        {/* App URL */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">App URL</label>
            <button
              type="button"
              onClick={() => void copyValue(appBaseUrl, 'App URL')}
              className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <Input value={appBaseUrl} readOnly className="font-mono text-xs h-9 bg-surface/30 border-border/40" />
          <p className="text-[11px] text-muted-foreground">Use this exact portal host inside the extension so pairing and API calls stay on the trusted origin.</p>
        </div>

        {/* Device name */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">Device Name</label>
          <Input
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            maxLength={120}
            className="h-9 text-sm border-border/40"
          />
          <p className="text-[11px] text-muted-foreground">Give this browser a clear name so you can revoke the correct device later.</p>
        </div>

        {/* Pairing Code */}
        <div className="rounded-xl border border-border/40 bg-surface/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-foreground">Current Pairing Code</p>
              {countdownLabel ? (
                <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
                  <Clock3 className="h-3 w-3" />
                  {countdownLabel}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-0.5">Generate only when the extension onboarding screen is open.</p>
              )}
            </div>
            <Button type="button" size="sm" onClick={handleGenerateCode} disabled={pending}>
              {pending ? 'Generating...' : pairingCode ? (
                <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
              ) : (
                <><ShieldCheck className="h-3.5 w-3.5" /> Generate</>
              )}
            </Button>
          </div>

          <div className="relative rounded-xl border border-border/40 bg-white px-4 py-3 pr-12">
            <p className={`font-mono ${hasPairingCode ? 'text-xl font-semibold tracking-wider text-foreground' : 'text-sm text-muted-foreground/40'}`}>
              {pairingCode ?? 'Not generated yet'}
            </p>
            {hasPairingCode && (
              <button
                type="button"
                onClick={() => pairingCode && void copyValue(pairingCode, 'Pairing code')}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">After you generate a code, paste it immediately into the extension together with the app URL and device name.</p>
        </div>

        {/* Download button */}
        <Button asChild variant="secondary" size="sm" className="w-full">
          <a href={extensionDownloadPath} download={extensionDownloadFileName}>
            <Download className="h-3.5 w-3.5" />
            Download ZIP v{extensionVersion}
          </a>
        </Button>
      </div>
    </div>
  );
}
