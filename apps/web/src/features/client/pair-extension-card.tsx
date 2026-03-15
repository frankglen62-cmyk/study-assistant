'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { Clock3, Copy, Download, RefreshCw } from 'lucide-react';

import type { ExtensionPairingCodeResponse } from '@study-assistant/shared-types';

import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/providers/toast-provider';
import { extensionDownloadFileName, extensionDownloadPath } from '@/lib/extension-distribution';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@study-assistant/ui';

interface PairExtensionCardProps {
  cardId?: string;
  appBaseUrl: string;
  initialDeviceName?: string;
  title?: string;
  description?: string;
  pairedDeviceCount?: number;
}

export function PairExtensionCard({
  cardId,
  appBaseUrl,
  initialDeviceName = 'My Study Device',
  title = 'Pair extension',
  description = 'Generate a short-lived code for the Chrome extension onboarding flow.',
  pairedDeviceCount = 0,
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
            // Ignore clipboard failures here; the explicit copy button still works.
          }

          pushToast({
            tone: 'success',
            title: 'Pairing code ready',
            description: 'The code was generated and copied. Use it in the extension onboarding screen before it expires.',
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
    <Card id={cardId}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {description}{' '}
              {pairedDeviceCount > 0
                ? 'Use this when you want to connect another browser or re-pair the current one.'
                : 'Have the extension onboarding screen open first so the new code can be used immediately.'}
            </CardDescription>
          </div>
          {pairedDeviceCount > 0 ? (
            <Badge tone="success">
              {pairedDeviceCount} paired {pairedDeviceCount === 1 ? 'device' : 'devices'}
            </Badge>
          ) : (
            <Badge tone="warning">No paired device yet</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          label="App URL"
          description="Enter this exact URL during extension onboarding so pairing and API calls stay on the trusted app origin."
        >
          <div className="flex gap-3">
            <Input value={appBaseUrl} readOnly />
            <Button type="button" variant="secondary" onClick={() => void copyValue(appBaseUrl, 'App URL')}>
              Copy URL
            </Button>
          </div>
        </FormField>

        <FormField label="Device name" description="Use a clear name so you can revoke the correct browser later.">
          <Input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={120} />
        </FormField>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={handleGenerateCode} disabled={pending}>
            {pending ? (
              'Generating...'
            ) : pairingCode ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Regenerate Code
              </>
            ) : (
              'Generate Pairing Code'
            )}
          </Button>
          <Button asChild type="button" variant="secondary">
            <a href={extensionDownloadPath} download={extensionDownloadFileName}>
              <Download className="h-4 w-4" />
              Download ZIP
            </a>
          </Button>
          {pairingCode ? (
            <Button type="button" variant="secondary" onClick={() => void copyValue(pairingCode, 'Pairing code')}>
              <Copy className="h-4 w-4" />
              Copy Code
            </Button>
          ) : null}
        </div>

        <div className="rounded-[20px] border border-border/70 bg-background/50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Install reminder</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Download the extension package first, extract it locally, then load it from <span className="font-mono text-foreground">chrome://extensions</span> using Developer mode.
          </p>
        </div>

        <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current pairing code</p>
            {countdownLabel ? (
              <Badge tone={isExpired ? 'danger' : secondsRemaining !== null && secondsRemaining < 90 ? 'warning' : 'accent'}>
                <Clock3 className="h-3.5 w-3.5" />
                {countdownLabel}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 break-all font-mono text-2xl font-semibold tracking-[0.3em]">
            {pairingCode ?? 'Not generated yet'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {expiresAt
              ? `Expires ${new Date(expiresAt).toLocaleString()}. ${isExpired ? 'Generate a fresh code before pairing.' : 'The latest code was auto-copied for you.'}`
              : 'Generate a new code when the extension onboarding screen is ready.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
