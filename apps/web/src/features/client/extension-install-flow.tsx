import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FolderOpen,
  Link2,
} from 'lucide-react';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@study-assistant/ui';

import {
  extensionDownloadFileName,
  extensionDownloadPath,
  extensionManifestFileName,
  extensionMinimumChromeVersion,
  extensionPackageUpdatedAt,
  extensionVersion,
} from '@/lib/extension-distribution';

function PreviewShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,#071922_0%,#06151c_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-3 flex items-center justify-between rounded-full border border-[#19404d] bg-[#0b202a] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#fd6f70]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f4c760]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3dd598]" />
        </div>
        <div className="h-2.5 w-28 rounded-full bg-[#163845]" />
      </div>
      <div className="rounded-[18px] border border-[#174150] bg-[#0a212c] p-4">
        {children}
      </div>
    </div>
  );
}

function DownloadPreview() {
  return (
    <PreviewShell>
      <div className="space-y-4">
        <div className="h-8 w-40 rounded-full bg-[#123845]" />
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[18px] border border-[#1a4b5a] bg-[#081820] p-5">
            <div className="mb-3 h-3 w-28 rounded-full bg-[#1a4754]" />
            <div className="flex items-center justify-between rounded-[16px] bg-[#0d2530] p-4">
              <div className="h-16 w-20 rounded-[16px] border-2 border-accent/90 bg-accent/5" />
              <div className="space-y-3">
                <div className="h-10 w-36 rounded-full bg-accent" />
                <div className="h-10 w-36 rounded-full border border-[#2a5764] bg-[#102f3a]" />
              </div>
            </div>
            <div className="mt-4 h-3 w-full rounded-full bg-[#11323d]" />
            <div className="mt-3 h-3 w-3/4 rounded-full bg-[#0f2a34]" />
          </div>
          <div className="space-y-3 rounded-[18px] border border-[#1a4b5a] bg-[#081820] p-4">
            <div className="h-3 w-24 rounded-full bg-[#173d49]" />
            <div className="h-10 rounded-full bg-[#0e2a35]" />
            <div className="h-10 rounded-full bg-[#0e2a35]" />
            <div className="h-10 rounded-full bg-[#0e2a35]" />
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

function LoadPreview() {
  return (
    <PreviewShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-full bg-[#11323e] px-4 py-3">
          <div className="h-3 w-36 rounded-full bg-[#dff4f5]/90" />
          <div className="h-5 w-5 rounded-full bg-accent" />
        </div>
        <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[18px] bg-[#0d2530] p-4">
            <div className="space-y-3">
              <div className="h-3 w-24 rounded-full bg-[#1b4957]" />
              <div className="h-3 w-20 rounded-full bg-[#143944]" />
              <div className="h-3 w-16 rounded-full bg-[#143944]" />
              <div className="mt-6 h-16 rounded-[16px] border border-[#245564] bg-[#091a22]" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-[18px] border border-[#2a5764] bg-[#102f3a] px-4 py-3 text-xs text-[#d7e6e8]">
              Developer mode: ON
            </div>
            <div className="rounded-[18px] bg-accent px-4 py-6 text-center text-sm font-semibold text-[#062028]">
              Load unpacked
            </div>
            <div className="rounded-[18px] border border-[#2a5764] bg-[#081820] px-4 py-3 text-xs text-[#9fb8be]">
              Select the extracted folder with manifest.json.
            </div>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

function PairPreview() {
  return (
    <PreviewShell>
      <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[18px] border border-[#1a4b5a] bg-[#081820] p-4">
          <div className="space-y-4">
            <div className="h-4 w-32 rounded-full bg-[#dff4f5]/90" />
            <div className="h-12 rounded-[16px] bg-[#0e2a35]" />
            <div className="h-4 w-36 rounded-full bg-[#173d49]" />
            <div className="h-12 rounded-[16px] bg-[#0e2a35]" />
            <div className="h-12 rounded-[16px] bg-[#0e2a35]" />
          </div>
        </div>
        <div className="space-y-4 rounded-[18px] border border-[#1a4b5a] bg-[#081820] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[16px] bg-[#0e2a35] p-4">
              <div className="h-3 w-20 rounded-full bg-[#173d49]" />
              <div className="mt-3 h-4 w-24 rounded-full bg-accent/70" />
            </div>
            <div className="rounded-[16px] bg-[#0e2a35] p-4">
              <div className="h-3 w-24 rounded-full bg-[#173d49]" />
              <div className="mt-3 h-4 w-20 rounded-full bg-accent/70" />
            </div>
          </div>
          <div className="rounded-[18px] bg-accent px-4 py-4 text-center text-sm font-semibold text-[#062028]">
            Pair device
          </div>
          <div className="rounded-[18px] border border-[#2a5764] bg-[#102f3a] px-4 py-3 text-xs text-[#d7e6e8]">
            App URL, short-lived pairing code, and device name are required.
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

const installCards = [
  {
    step: '01',
    title: 'Download the ZIP',
    description: 'Get the current extension package from the portal. Clients download the same build from one stable link.',
    icon: Download,
    preview: <DownloadPreview />,
  },
  {
    step: '02',
    title: 'Load it in Chrome',
    description: 'Extract the ZIP first, then open chrome://extensions, enable Developer mode, and use Load unpacked.',
    icon: FolderOpen,
    preview: <LoadPreview />,
  },
  {
    step: '03',
    title: 'Pair your device',
    description: 'Generate a short-lived pairing code from the portal, paste it into the extension, and start a session.',
    icon: Link2,
    preview: <PairPreview />,
  },
] as const;

export function ExtensionInstallFlow({
  compact = false,
  showActions = true,
  pairedDeviceCount = 0,
}: {
  compact?: boolean;
  showActions?: boolean;
  pairedDeviceCount?: number;
}) {
  const hasPairedDevice = pairedDeviceCount > 0;

  return (
    <Card>
      <CardHeader className={compact ? 'pb-4' : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              {hasPairedDevice
                ? compact
                  ? 'Add or update the extension'
                  : 'Add another browser or update your extension'
                : compact
                  ? 'Install the extension'
                  : 'Install in 3 steps'}
            </CardTitle>
            <CardDescription>
              {hasPairedDevice
                ? 'You already have a paired device. Use this flow to add another browser, refresh the ZIP build, or reinstall cleanly.'
                : 'Download, load, then pair. Chrome still requires a manual Load unpacked install for this ZIP distribution.'}
            </CardDescription>
          </div>
          <div
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              hasPairedDevice ? 'bg-success/12 text-success' : 'bg-warning/12 text-warning',
            )}
          >
            {hasPairedDevice ? `${pairedDeviceCount} device${pairedDeviceCount === 1 ? '' : 's'} already paired` : 'First-time setup required'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Combined info row: folder warning + release info */}
        <div className="rounded-2xl border border-border/60 bg-surface/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Select the right folder</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose the extracted folder containing
                <span className="mx-1 font-mono text-foreground">{extensionManifestFileName}</span>
                directly inside it. Don't select the ZIP or a parent folder.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground border-t border-border/40 pt-3">
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-foreground">v{extensionVersion}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">Chrome {extensionMinimumChromeVersion}+</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{new Date(extensionPackageUpdatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className={cn('grid gap-4', compact ? 'xl:grid-cols-3' : 'lg:grid-cols-3')}>
          {installCards.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.step}
                className="group overflow-hidden rounded-2xl border border-border/60 bg-background/50 transition hover:-translate-y-0.5 hover:border-accent/40"
              >
                <div className="border-b border-border/50 bg-gradient-to-br from-accent/8 via-surface/30 to-background/60 p-2.5">
                  {item.preview}
                </div>
                <div className="space-y-2.5 p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.step}</p>
                      <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>

        {showActions ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                <Download className="h-4 w-4" />
                Download Extension ZIP
              </a>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/account#paired-devices">Manage Devices</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/extension-guide#update-extension">
                Update Instructions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {!compact ? (
              <Button asChild variant="secondary">
                <Link href="/extension-guide#pair-extension-flow">
                  {hasPairedDevice ? 'Pair Another Device' : 'Pair Now'}
                  <CheckCircle2 className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
