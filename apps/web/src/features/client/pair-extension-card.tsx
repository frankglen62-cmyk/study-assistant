'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { Clock3, Copy, Download, RefreshCw, ShieldCheck, Link2, CopyCheck, Laptop } from 'lucide-react';

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
  simplified?: boolean;
}

function getBrowserName() {
  if (typeof window === 'undefined') return 'My Study Device';
  const ua = window.navigator.userAgent;
  let browser = "Chrome";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Brave/")) browser = "Brave";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";
  
  let os = "Device";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "Mac";
  else if (ua.includes("Linux")) os = "Linux";
  
  return `Operations ${browser} (${os})`;
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
}: PairExtensionCardProps) {
  const { pushToast } = useToast();
  const [deviceName, setDeviceName] = useState(initialDeviceName ?? 'My Study Device');
  const [pending, setPending] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

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
          const payload = (await response.json()) as Partial<ExtensionPairingCodeResponse> & { error?: string };
          if (!response.ok || !payload.pairingCode || !payload.expiresAt) {
            throw new Error(payload.error ?? 'Pairing code generation failed.');
          }
          setPairingCode(payload.pairingCode);
          setExpiresAt(payload.expiresAt);
          try { await navigator.clipboard.writeText(payload.pairingCode); } catch { /* best effort */ }
          pushToast({ tone: 'success', title: 'Pairing code generated & copied', description: 'Paste it into the extension onboarding screen.' });
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

  async function handleCopyAll() {
    if (!pairingCode) return;
    const block = `App URL: ${appBaseUrl}\nDevice Name: ${deviceName}\nPairing Code: ${pairingCode}`;
    try {
      await navigator.clipboard.writeText(block);
      pushToast({ tone: 'success', title: `All pairing details copied`, description: 'Paste them anywhere you need.' });
    } catch {
      pushToast({ tone: 'warning', title: `Unable to copy`, description: 'Copy them manually.' });
    }
  }

  return (
    <div id={cardId} className="rounded-2xl border border-border/40 bg-background shadow-card overflow-hidden">
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

      <div className="p-6 space-y-6">
        {/* Status row — compact inline badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${pairedDeviceCount > 0 ? 'bg-accent/10 text-accent' : 'bg-muted/50 text-muted-foreground'}`}>
            {pairedDeviceCount > 0 ? 'Paired' : 'Ready'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            ZIP v{extensionVersion}
          </span>
          {latestInstalledVersion && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Installed v{latestInstalledVersion}
            </span>
          )}
        </div>

        {/* Highlighted Pairing Code Section */}
        <div className={`relative rounded-xl border p-5 transition-colors overflow-hidden ${hasPairingCode ? (isExpired ? 'border-red-200 bg-red-50/30 dark:border-red-500/30' : 'border-accent/40 bg-accent/5') : 'border-border/40 bg-surface/50 dark:bg-surface'}`}>
          
          {hasPairingCode && !isExpired && (
             <div className="absolute top-0 left-0 h-1 bg-accent/20 w-full overflow-hidden">
                <div 
                  className="h-full bg-accent transition-all duration-1000 ease-linear" 
                  style={{ width: `${Math.max(0, (secondsRemaining ?? 0) / 300 * 100)}%` }}
                />
             </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={`text-sm font-bold ${hasPairingCode && !isExpired ? 'text-accent' : 'text-foreground'}`}>Generate Code</p>
              {countdownLabel ? (
                <p className={`text-[11px] mt-0.5 flex items-center gap-1 font-medium ${isExpired ? 'text-red-500' : 'text-accent/80'}`}>
                  <Clock3 className="h-3.5 w-3.5" />
                  {isExpired ? 'Expired — regenerate below.' : `Expires in ${countdownLabel}`}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-0.5">Click generate when the extension is ready.</p>
              )}
            </div>
            <Button type="button" size="sm" onClick={handleGenerateCode} disabled={pending}>
              {pending ? 'Generating...' : pairingCode ? (
                <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
              ) : (
                <><ShieldCheck className="h-3.5 w-3.5" /> Generate Code</>
              )}
            </Button>
          </div>

          <div className="relative rounded-xl border border-border/40 bg-background px-4 py-3 pr-12 shadow-sm">
            <p className={`font-mono ${hasPairingCode ? 'text-xl font-bold tracking-[0.15em] text-foreground' : 'text-sm text-muted-foreground/40 font-medium tracking-normal'}`}>
              {pairingCode ?? 'XXXX-XXXX-XXXX-XXXX'}
            </p>
            {hasPairingCode && (
              <button
                type="button"
                onClick={() => pairingCode && void copyValue(pairingCode, 'Pairing code')}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-accent/50"
                title="Copy Pairing Code"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Setup Details */}
        {!simplified && (
          <div className="grid gap-4 md:grid-cols-2 pt-2">
            {/* App URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 text-muted-foreground"/> App URL</label>
                <button
                  type="button"
                  onClick={() => void copyValue(appBaseUrl, 'App URL')}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <Input value={appBaseUrl} readOnly className="font-mono text-xs h-9 bg-surface/30 border-border/40" />
            </div>

            {/* Device name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                 <label className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Laptop className="h-3.5 w-3.5 text-muted-foreground"/> Device Name</label>
                 <button
                  type="button"
                  onClick={() => void copyValue(deviceName, 'Device Name')}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              
              <Input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                maxLength={120}
                className="h-9 text-sm border-border/40"
              />
            </div>
          </div>
        )}
        
        {/* Action Row */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-border/30">
           {!simplified && (
             <Button type="button" variant="secondary" size="sm" className="flex-1" disabled={!hasPairingCode} onClick={handleCopyAll}>
               {hasPairingCode ? <CopyCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
               Copy All Details
             </Button>
           )}
          <Button asChild variant={simplified ? 'secondary' : 'ghost'} size="sm" className={simplified ? 'w-full' : 'flex-1'}>
            <a href={extensionDownloadPath} download={extensionDownloadFileName}>
              <Download className="h-4 w-4" />
              Download ZIP v{extensionVersion}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
