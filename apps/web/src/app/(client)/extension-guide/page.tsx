import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FolderOpen,
  KeyRound,
  Link2,
  Monitor,
  ShieldCheck,
} from 'lucide-react';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

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
  const context = await requirePageUser(['client']);
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
  const hasCredits = context.wallet.remaining_seconds > 0;
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
        badge="Client Area"
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
              <Link href="/dashboard">Back To Dashboard</Link>
            </Button>
          </>
        }
      />

      {isOutdatedInstalledVersion ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800">Update available for your installed browser</p>
              <p className="text-sm text-amber-700">
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
        <Card>
          <CardHeader>
            <CardTitle>Install or update in 3 simple steps</CardTitle>
            <CardDescription>
              This is the only install flow that matters. Everything else is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {setupSteps.map((step) => {
              const Icon = step.icon;

              return (
                <div key={step.label} className="flex items-start gap-4 rounded-xl border border-border/40 bg-surface/30 p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              );
            })}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800">Important folder reminder</p>
                  <p className="text-sm text-amber-700">
                    When Chrome asks for a folder, select the extracted folder where <span className="font-mono text-amber-900">{extensionManifestFileName}</span> is directly visible.
                    Do not select the ZIP file itself or a parent folder above it.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current extension status</CardTitle>
            <CardDescription>
              This is the live portal view of your latest ZIP build and paired browser state.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={hasPairedDevice ? 'success' : 'warning'}>{pairingStatusLabel}</Badge>
              <Badge tone="accent">{`Current ZIP v${extensionVersion}`}</Badge>
              <Badge tone="neutral">{`Chrome ${extensionMinimumChromeVersion}+`}</Badge>
              <Badge tone="neutral">{latestPackageDateLabel}</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-surface/30 p-5">
                <p className="text-xs font-medium text-muted-foreground">Pairing status</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{pairingStatusLabel}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {hasPairedDevice
                    ? `${activeDevices.length} active ${activeDevices.length === 1 ? 'browser is' : 'browsers are'} connected to your account.`
                    : 'No browser is connected to your account yet.'}
                </p>
              </div>
              <div className="rounded-xl border border-border/40 bg-surface/30 p-5">
                <p className="text-xs font-medium text-muted-foreground">Installed build</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{installedVersion ?? 'Not detected'}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {isOutdatedInstalledVersion
                    ? 'This browser is behind the latest ZIP and needs a manual refresh.'
                    : 'The latest active browser matches the current ZIP build or has not reported a version yet.'}
                </p>
              </div>
              <div className="rounded-xl border border-border/40 bg-surface/30 p-5">
                <p className="text-xs font-medium text-muted-foreground">Latest active browser</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{latestDevice?.name ?? 'No browser yet'}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {latestDevice ? `Last seen ${latestDevice.lastSeen}.` : 'Pair a browser first so the portal can track its state.'}
                </p>
              </div>
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
                <p className="text-xs font-medium text-muted-foreground">Next step</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{nextStepLabel}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {hasOpenSession
                    ? 'A session is already active, so the extension can continue immediately after setup.'
                    : 'If pairing is already complete, open or resume a session before using analysis.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                  <Download className="h-4 w-4" />
                  Download Latest ZIP
                </a>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/account#paired-devices">
                  <Monitor className="h-4 w-4" />
                  Manage Devices
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/sessions">
                  <KeyRound className="h-4 w-4" />
                  Open Sessions
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Need help?</CardTitle>
          <CardDescription>
            Keep it simple: if install or pairing still fails, use one of these next actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/contact">
              <ShieldCheck className="h-4 w-4" />
              Contact Support
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/account#paired-devices">
              <Monitor className="h-4 w-4" />
              Review Paired Browsers
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <a href="#pairing-mode">
              Go To Pairing Mode
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
