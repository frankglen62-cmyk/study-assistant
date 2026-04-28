import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FolderOpen,
  KeyRound,
  Monitor,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Badge, Button } from '@study-assistant/ui';

import { PageHeading } from '@/components/page-heading';
import { PairExtensionCard } from '@/features/client/pair-extension-card';
import { ExtensionGuideHelp } from '@/features/client/extension-guide-help';
import { ExtensionChangelogPanel } from '@/features/client/extension-changelog-panel';
import { ExtensionInstallSteps } from '@/features/client/extension-install-steps';
import { requirePageUser } from '@/lib/auth/page-context';
import {
  extensionDownloadFileName,
  extensionDownloadPath,
  extensionMinimumChromeVersion,
  extensionPackageUpdatedAt,
  extensionVersion,
} from '@/lib/extension-distribution';
import { extensionChangelog } from '@/lib/extension-changelog';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { env } from '@/lib/env/server';
import { getClientAccountData, getClientPortalOverview } from '@/features/client/server';

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

interface VersionStatusStripProps {
  hasPairedDevice: boolean;
  installedVersion: string | null;
  isOutdated: boolean;
  latestPackageDate: string;
  lastSeenAt: string | null;
}

function VersionStatusStrip({
  hasPairedDevice,
  installedVersion,
  isOutdated,
  latestPackageDate,
  lastSeenAt,
}: VersionStatusStripProps) {
  if (!hasPairedDevice) {
    return null;
  }

  const tone = isOutdated
    ? 'border-amber-200/70 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/10'
    : 'border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/10';

  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border px-5 py-3 text-sm ${tone}`}
    >
      <div className="flex items-center gap-2">
        {isOutdated ? (
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
        )}
        <span className="font-medium text-foreground">
          {isOutdated ? 'Update available' : 'Extension is up to date'}
        </span>
      </div>
      <span className="text-muted-foreground">
        Installed <span className="font-mono text-foreground">v{installedVersion ?? '—'}</span>
      </span>
      <span className="text-muted-foreground">
        Latest <span className="font-mono text-foreground">v{extensionVersion}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        Last heartbeat {formatRelativeTime(lastSeenAt)}
      </span>
      <span className="ml-auto text-xs text-muted-foreground">
        Build packaged {latestPackageDate}
      </span>
    </div>
  );
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
  const latestPackageDateLabel = new Date(extensionPackageUpdatedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const installedVersion = latestDevice?.version?.trim() ?? null;
  const installedKnown = Boolean(installedVersion) && installedVersion !== 'Unknown version';
  const isOutdatedInstalledVersion = installedKnown && installedVersion !== extensionVersion;
  const hasOpenSession = Boolean(overview.openSession);
  const hasCredits = context.wallet.remaining_seconds > 0;
  const nextStepLabel = getNextStep({
    hasPairedDevice,
    isOutdatedInstalledVersion,
    hasOpenSession,
    hasCredits,
  });

  const latestEntry = extensionChangelog[0] ?? null;

  const pairingCard = (
    <PairExtensionCard
      cardId="pairing-mode"
      appBaseUrl={env.NEXT_PUBLIC_APP_URL}
      initialDeviceName={`${context.profile.full_name.split(' ')[0] || 'My'} Study Device`}
      title="Pairing Mode"
      description={
        hasPairedDevice
          ? 'Use this whenever you want to add another browser, reconnect, or copy the app URL again.'
          : 'After loading the extension in Chrome, generate a code here and paste it into the extension.'
      }
      pairedDeviceCount={activeDevices.length}
      latestInstalledVersion={installedVersion}
      autoGenerateOnMount={!hasPairedDevice}
    />
  );

  const installSteps = (
    <ExtensionInstallSteps
      heading={
        hasPairedDevice ? 'Need to install on another browser?' : 'Install in 3 simple steps'
      }
      subheading={
        hasPairedDevice
          ? 'Repeat these steps on each new browser you want to pair.'
          : 'This is the only install flow that matters. Everything else is optional.'
      }
    />
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeading
        eyebrow="Chrome Extension"
        title="Extension Guide"
        description={
          hasPairedDevice
            ? isOutdatedInstalledVersion
              ? `Your installed browser is on v${installedVersion}. Update to v${extensionVersion} to keep things stable.`
              : 'Pair more browsers, regenerate codes, or grab the latest ZIP — all from one place.'
            : 'Three steps to get going: download the ZIP, load it in Chrome, then pair this browser.'
        }
        badge="Client Area"
        actions={
          <>
            {!isOutdatedInstalledVersion ? (
              <Button asChild>
                <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                  <Download className="h-4 w-4" />
                  {`Download ZIP v${extensionVersion}`}
                </a>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href="/dashboard">
                <ArrowRight className="h-4 w-4 rotate-180" />
                Back to dashboard
              </Link>
            </Button>
          </>
        }
      />

      {isOutdatedInstalledVersion ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-card dark:border-amber-500/40 dark:bg-amber-500/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Update available — v{extensionVersion} is out
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-200/90">
                {`Your latest active browser is on v${installedVersion}. Download the ZIP, extract it, then reload the unpacked extension at chrome://extensions.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                  <Download className="h-4 w-4" />
                  Update now (v{extensionVersion})
                </a>
              </Button>
            </div>
          </div>
          {latestEntry ? <ExtensionChangelogPanel className="mt-4" /> : null}
        </div>
      ) : null}

      <VersionStatusStrip
        hasPairedDevice={hasPairedDevice}
        installedVersion={installedVersion}
        isOutdated={isOutdatedInstalledVersion}
        latestPackageDate={latestPackageDateLabel}
        lastSeenAt={latestDevice?.lastSeenAt ?? null}
      />

      {!hasPairedDevice ? (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 shadow-card">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-foreground">{nextStepLabel}</p>
              <p className="text-sm text-muted-foreground">
                Already have the ZIP loaded in Chrome? Skip to{' '}
                <a
                  href="#pairing-mode"
                  className="font-medium text-accent underline-offset-4 hover:underline"
                >
                  Pairing Mode
                </a>
                . Otherwise, start with Step 1 below.
              </p>
            </div>
            <Badge tone="accent">
              <ChevronRight className="h-3 w-3" />
              Compatible with Chrome {extensionMinimumChromeVersion}+
            </Badge>
          </div>
        </div>
      ) : null}

      {/* State-based ordering */}
      {hasPairedDevice ? (
        <>
          {pairingCard}
          <details className="group rounded-2xl border border-border/40 bg-background shadow-card">
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 text-sm font-medium text-foreground">
              <span className="inline-flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                Show install steps for another browser
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="border-t border-border/40 px-1 pb-1">{installSteps}</div>
          </details>
        </>
      ) : (
        <>
          {installSteps}
          {pairingCard}
        </>
      )}

      {/* Status snapshot — only when paired and not outdated (otherwise the strip + alert covers it) */}
      {hasPairedDevice && !isOutdatedInstalledVersion ? (
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-background shadow-card">
          <div className="border-b border-border/40 px-6 py-5">
            <h3 className="text-base font-semibold text-foreground">
              Browsers paired to this account
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeDevices.length === 1
                ? '1 browser is currently connected.'
                : `${activeDevices.length} browsers are currently connected.`}
            </p>
          </div>
          <div className="p-6">
            <ul className="divide-y divide-border/30">
              {activeDevices.slice(0, 5).map((device) => {
                const matches = device.version === extensionVersion;
                return (
                  <li
                    key={device.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{device.name}</p>
                      <p className="text-xs text-muted-foreground">
                        v{device.version} · Last seen {formatRelativeTime(device.lastSeenAt)}
                      </p>
                    </div>
                    <Badge tone={matches ? 'success' : 'warning'}>
                      {matches ? 'Up to date' : `Behind v${extensionVersion}`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
            {activeDevices.length > 5 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing 5 of {activeDevices.length}. View all in{' '}
                <Link href="/account#paired-devices" className="text-accent hover:underline">
                  Account → Paired devices
                </Link>
                .
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Changelog (always available, collapsed) */}
      {!isOutdatedInstalledVersion ? <ExtensionChangelogPanel /> : null}

      {/* Help / Troubleshooting */}
      <ExtensionGuideHelp />

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button asChild variant="secondary">
          <Link href="/account#paired-devices">
            <Monitor className="h-4 w-4" />
            Manage devices
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/sessions">
            <KeyRound className="h-4 w-4" />
            Open sessions
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/contact">
            <ShieldCheck className="h-4 w-4" />
            Contact support
          </Link>
        </Button>
      </div>
    </div>
  );
}
