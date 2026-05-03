import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FolderOpen,
  KeyRound,
  Link2,
  Monitor,
  ShieldCheck,
} from 'lucide-react';

import { Badge, Button } from '@study-assistant/ui';

import { PageHeading } from '@/components/page-heading';
import { PairExtensionCard } from '@/features/client/pair-extension-card';
import { requirePageUser } from '@/lib/auth/page-context';
import {
  extensionDownloadFileName,
  extensionDownloadPath,
  extensionManifestFileName,
  extensionMinimumChromeVersion,
  extensionPackageUpdatedAt,
  extensionVersion,
} from '@/lib/extension-distribution';
import { env } from '@/lib/env/server';
import { getClientAccountData, getClientPortalOverview } from '@/features/client/server';

const setupSteps = [
  {
    label: 'Step 1',
    title: 'Download the latest ZIP',
    description: 'Use the download button on this page or the dashboard. Always install from the latest build only.',
    icon: Download,
  },
  {
    label: 'Step 2',
    title: 'Load it in Chrome',
    description: `Extract the ZIP first, open chrome://extensions, enable Developer mode, then choose the folder that contains ${extensionManifestFileName}.`,
    icon: FolderOpen,
  },
  {
    label: 'Step 3',
    title: 'Pair this browser',
    description: 'Use Pairing Mode above to copy the app URL, generate a short-lived code, and paste both into the extension onboarding screen.',
    icon: Link2,
  },
] as const;

function getNextStep({
  hasPairedDevice,
  isOutdatedInstalledVersion,
  hasOpenSession,
  hasCredits,
}: {
  hasPairedDevice: boolean;
  isOutdatedInstalledVersion: boolean;
  hasOpenSession: boolean;
  hasCredits: boolean;
}) {
  if (!hasPairedDevice) {
    return 'Download the ZIP and pair your first browser';
  }

  if (isOutdatedInstalledVersion) {
    return 'Update the installed browser to the latest ZIP build';
  }

  if (!hasCredits) {
    return 'Buy credits before using Analyze Current Page';
  }

  if (!hasOpenSession) {
    return 'Open a session, then use the extension side panel';
  }

  return 'Open the extension side panel and start using it';
}

export default async function ExtensionGuidePage() {
  const context = await requirePageUser(['admin', 'super_admin']);
  const [account, overview] = await Promise.all([
    getClientAccountData(context.userId),
    getClientPortalOverview(context.userId),
  ]);

  const activeDevices = account.devices.filter((device) => device.status === 'active');
  const hasPairedDevice = activeDevices.length > 0;
  const latestDevice = activeDevices[0] ?? null;
  const latestPackageDateLabel = new Date(extensionPackageUpdatedAt).toLocaleString();
  const installedVersion = latestDevice?.version?.trim() ?? null;
  const isOutdatedInstalledVersion = Boolean(installedVersion) && installedVersion !== extensionVersion;
  const hasOpenSession = Boolean(overview.openSession);
  const hasCredits = true; // Admin bypasses credit constraints
  const pairingStatusLabel = hasPairedDevice ? 'Paired' : 'Not paired';
  const nextStepLabel = getNextStep({
    hasPairedDevice,
    isOutdatedInstalledVersion,
    hasOpenSession,
    hasCredits,
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeading
        eyebrow="Chrome Extension"
        title="Extension Guide"
        description="Simple setup only: download the ZIP, load it in Chrome, then use Pairing Mode to connect the browser."
        badge="Admin Area"
        actions={
          <>
            <Button asChild>
              <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                <Download className="h-4 w-4" />
                {`Download ZIP v${extensionVersion}`}
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href="#pairing-mode">Pairing Mode</a>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/dashboard">Back To Dashboard</Link>
            </Button>
          </>
        }
      />

      {isOutdatedInstalledVersion ? (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Update available for your installed browser</p>
              <p className="text-sm text-amber-700 dark:text-amber-200/90">
                {`Your latest active browser is still on ${installedVersion}. Download ZIP v${extensionVersion}, extract it, then reload the unpacked extension from chrome://extensions.`}
              </p>
            </div>
            <Button asChild>
              <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                <Download className="h-4 w-4" />
                Update Now
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      <PairExtensionCard
        cardId="pairing-mode"
        appBaseUrl={env.NEXT_PUBLIC_APP_URL}
        initialDeviceName={`${context.profile.full_name.split(' ')[0] || 'My'} Study Device`}
        title="Pairing Mode"
        description={
          hasPairedDevice
            ? 'Use this first whenever you want to add another browser, reconnect the same browser, or copy the exact app URL again.'
            : 'Start here after you load the extension in Chrome. This is the only part you need to pair the browser.'
        }
        pairedDeviceCount={activeDevices.length}
        latestInstalledVersion={installedVersion}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Install Steps */}
        <div className="rounded-2xl border border-border/40 bg-background shadow-card overflow-hidden">
          <div className="border-b border-border/40 px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">Install or update in 3 steps</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The only install flow that matters.
            </p>
          </div>
          <div className="p-5 space-y-3">
            {setupSteps.map((step) => {
              const Icon = step.icon;

              return (
                <div key={step.label} className="flex items-start gap-3 rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold text-accent uppercase tracking-wider">{step.label}</p>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}

            <div className="rounded-xl border border-amber-200/60 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">Folder reminder</p>
                  <p className="text-xs text-amber-700 dark:text-amber-200/90">
                    Select the extracted folder where <span className="font-mono text-amber-900 dark:text-amber-300">{extensionManifestFileName}</span> is directly visible.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Extension Status */}
        <div className="rounded-2xl border border-border/40 bg-background shadow-card overflow-hidden">
          <div className="border-b border-border/40 px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">Extension status</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Live view of your ZIP build and paired browser.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={hasPairedDevice ? 'success' : 'warning'}>{pairingStatusLabel}</Badge>
              <Badge tone="accent">{`ZIP v${extensionVersion}`}</Badge>
              <Badge suppressHydrationWarning tone="neutral">{`Chrome ${extensionMinimumChromeVersion}+`}</Badge>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Pairing</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{pairingStatusLabel}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {hasPairedDevice
                    ? `${activeDevices.length} active ${activeDevices.length === 1 ? 'browser' : 'browsers'} connected.`
                    : 'No browser connected yet.'}
                </p>
              </div>
              <div className="rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Installed build</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{installedVersion ?? 'Not detected'}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isOutdatedInstalledVersion ? 'Behind the latest ZIP.' : 'Matches current ZIP.'}
                </p>
              </div>
              <div className="rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active browser</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{latestDevice?.name ?? 'None'}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {latestDevice ? `Last seen ${latestDevice.lastSeen}.` : 'Pair a browser first.'}
                </p>
              </div>
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-3.5">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-accent" />
                  <p className="text-[10px] font-medium text-accent uppercase tracking-wider">Next step</p>
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">{nextStepLabel}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                  <Download className="h-3.5 w-3.5" />
                  Download ZIP
                </a>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin/settings">
                  <Monitor className="h-3.5 w-3.5" />
                  Devices
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin/dashboard">
                  <KeyRound className="h-3.5 w-3.5" />
                  Sessions
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="rounded-2xl border border-border/40 bg-background p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Need help?</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              If install or pairing still fails, try one of these.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/contact">
                <ShieldCheck className="h-3.5 w-3.5" />
                Support
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/settings">
                <Monitor className="h-3.5 w-3.5" />
                Devices
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <a href="#pairing-mode">
                Pairing Mode
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
