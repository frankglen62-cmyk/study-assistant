import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  FolderOpen,
  KeyRound,
  Monitor,
  ShieldCheck,
} from 'lucide-react';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

import { PageHeading } from '@/components/page-heading';
import { GuideDisclosureCard } from '@/features/client/guide-disclosure-card';
import { ExtensionGuideChecklist } from '@/features/client/extension-guide-checklist';
import { ExtensionInstallHelper } from '@/features/client/extension-install-helper';
import { ExtensionInstallFlow } from '@/features/client/extension-install-flow';
import { ExtensionSetupProgress } from '@/features/client/extension-setup-progress';
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

const beforeYouStartItems = [
  {
    title: 'Chrome desktop required',
    description: `Use Google Chrome or another Chromium browser on desktop. Minimum supported version is ${extensionMinimumChromeVersion}.`,
    icon: Monitor,
  },
  {
    title: 'Developer mode is required',
    description: 'Because this build is distributed as a ZIP, Chrome requires Developer mode and Load unpacked during installation.',
    icon: ShieldCheck,
  },
  {
    title: 'You need credits to analyze',
    description: 'Install and pairing can be done anytime, but session start and page analysis still require available credits.',
    icon: CreditCard,
  },
  {
    title: 'Keep the extracted folder',
    description: `Do not delete or move the extracted folder after installation. Chrome expects the folder containing ${extensionManifestFileName} to stay in place.`,
    icon: FolderOpen,
  },
] as const;

const setupSteps = [
  {
    step: '1',
    title: 'Download the extension ZIP from the portal',
    description: 'Use the Download ZIP button in this guide, the dashboard, or the account page.',
  },
  {
    step: '2',
    title: 'Extract the downloaded file',
    description: 'Chrome will not install the ZIP itself. Extract it to a normal folder first.',
  },
  {
    step: '3',
    title: 'Open the Chrome extensions page',
    description: 'Go to chrome://extensions and turn on Developer mode in the upper-right corner.',
  },
  {
    step: '4',
    title: 'Load the extracted folder containing manifest.json',
    description: `Click Load unpacked and choose the extracted folder where ${extensionManifestFileName} is directly visible.`,
  },
  {
    step: '5',
    title: 'Pin the extension',
    description: 'Click the puzzle piece icon in Chrome, then pin the Study Assistant extension so it stays visible in your toolbar.',
  },
  {
    step: '6',
    title: 'Sign in to the web app',
    description: 'Log in to the client portal using your registered email and password. Your account must be active.',
  },
  {
    step: '7',
    title: 'Generate a pairing code',
    description: 'Use the pairing section below. The code is short-lived and should be pasted into the extension right away.',
  },
  {
    step: '8',
    title: 'Enter the app URL, code, and device name',
    description: 'Open the extension, paste the app URL and pairing code, then give the browser a clear device name.',
  },
  {
    step: '9',
    title: 'Start a session and analyze a page',
    description: 'Once paired, start a session and use Analyze Current Page from the extension side panel.',
  },
] as const;

const updateSteps = [
  'Download the latest ZIP package from this page.',
  'Extract it to a new folder or overwrite the existing extracted folder carefully.',
  'Open chrome://extensions and find the Study Assistant extension.',
  'If the extension already points to the same extracted folder, click Reload. Otherwise remove the old unpacked copy and load the new extracted folder.',
  'Re-open the extension and verify that pairing and credits still look correct.',
] as const;

const troubleshootingGroups = [
  {
    title: 'Install issues',
    tone: 'warning' as const,
    items: [
      {
        problem: 'The ZIP downloaded, but Chrome will not install it directly',
        solution: 'That is expected. Extract the ZIP first, then open chrome://extensions, enable Developer mode, and use Load unpacked.',
      },
      {
        problem: 'Chrome rejects the selected folder',
        solution: `Choose the extracted folder that contains ${extensionManifestFileName}. If you select the wrong level or the ZIP itself, Chrome will not load it.`,
      },
      {
        problem: 'Extension not appearing in the toolbar',
        solution: 'Click the puzzle icon in Chrome and pin the Study Assistant extension. Also confirm it is enabled on chrome://extensions.',
      },
    ],
  },
  {
    title: 'Pairing issues',
    tone: 'accent' as const,
    items: [
      {
        problem: 'Extension shows Not Paired',
        solution: 'Generate a fresh code from the portal and confirm the App URL is exactly correct. Pairing codes expire after a few minutes.',
      },
      {
        problem: 'The pairing code expired before I used it',
        solution: 'Use Regenerate Code in the pairing section and paste the new code right away. The latest code is auto-copied when generated.',
      },
      {
        problem: 'Device was revoked',
        solution: 'A revoked browser must be paired again with a new code. You can review and revoke devices in the Account page.',
      },
    ],
  },
  {
    title: 'Session and credit issues',
    tone: 'success' as const,
    items: [
      {
        problem: 'No Credits or Insufficient Credits',
        solution: 'Your wallet balance is too low. Buy more credits from the Buy Credits page, then refresh the extension panel.',
      },
      {
        problem: 'Session ended unexpectedly',
        solution: 'Sessions may end after idle timeout or credit exhaustion. Start a new session once the account is active and funded again.',
      },
    ],
  },
  {
    title: 'Analyze issues',
    tone: 'danger' as const,
    items: [
      {
        problem: 'Low Confidence warning',
        solution: 'The detected subject or category may not match the page well. Manually adjust the subject/category and analyze again.',
      },
      {
        problem: 'No Match result',
        solution: 'The private source library may not yet cover that topic. Contact your administrator to request additional source coverage.',
      },
    ],
  },
] as const;

function getNextAction({
  hasPairedDevice,
  hasCredits,
  hasOpenSession,
}: {
  hasPairedDevice: boolean;
  hasCredits: boolean;
  hasOpenSession: boolean;
}) {
  if (!hasPairedDevice) {
    return {
      eyebrow: 'Recommended next step',
      title: 'Download the ZIP, load it in Chrome, then pair your first browser',
      description:
        'Your account is not connected to any browser yet. Finish the install flow first, then generate a short-lived pairing code below.',
      primary: {
        href: extensionDownloadPath,
        label: 'Download Extension ZIP',
        download: true,
        icon: Download,
      },
      secondary: {
        href: '#pair-extension-flow',
        label: 'Jump To Pairing',
      },
      toneClass: 'border-warning/20 bg-warning/5',
    };
  }

  if (!hasCredits) {
    return {
      eyebrow: 'Recommended next step',
      title: 'Buy credits before trying Analyze Current Page',
      description:
        'The extension is already connected, but analysis is blocked until your account has available credits.',
      primary: {
        href: '/buy-credits',
        label: 'Buy Credits',
        download: false,
        icon: CreditCard,
      },
      secondary: {
        href: '/account#paired-devices',
        label: 'Review Devices',
      },
      toneClass: 'border-warning/20 bg-warning/5',
    };
  }

  if (!hasOpenSession) {
    return {
      eyebrow: 'Recommended next step',
      title: 'Open the extension and start a session',
      description:
        'Your browser is paired and funded. The next thing that unlocks analysis is starting a session from the portal or extension side panel.',
      primary: {
        href: '/sessions',
        label: 'Open Sessions',
        download: false,
        icon: KeyRound,
      },
      secondary: {
        href: '#pair-extension-flow',
        label: 'Pair Another Browser',
      },
      toneClass: 'border-accent/20 bg-accent/5',
    };
  }

  return {
    eyebrow: 'Recommended next step',
    title: 'Open the extension side panel and analyze the current page',
    description:
      'Everything is ready: your browser is paired, credits are available, and a session is already active.',
    primary: {
      href: '/usage-logs',
      label: 'Review Recent Usage',
      download: false,
      icon: CheckCircle2,
    },
    secondary: {
      href: '/dashboard',
      label: 'Back To Dashboard',
    },
    toneClass: 'border-success/20 bg-success/5',
  };
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
  const hasCredits = context.wallet.remaining_seconds > 0;
  const hasOpenSession = Boolean(overview.openSession);
  const latestPackageDateLabel = new Date(extensionPackageUpdatedAt).toLocaleString();
  const installedVersion = latestDevice?.version?.trim() ?? null;
  const isOutdatedInstalledVersion =
    Boolean(installedVersion) && installedVersion !== extensionVersion;
  const nextAction = getNextAction({
    hasPairedDevice,
    hasCredits,
    hasOpenSession,
  });
  const NextActionIcon = nextAction.primary.icon;

  return (
    <div className="space-y-6 pb-12">
      <PageHeading
        eyebrow="Chrome Extension"
        title={hasPairedDevice ? 'Manage and update your extension' : 'Extension Setup Guide'}
        description={
          hasPairedDevice
            ? `You already have ${activeDevices.length} paired ${activeDevices.length === 1 ? 'device' : 'devices'}. Use this page to install another browser, refresh the ZIP build, or generate a new pairing code.`
            : 'Install, pair, and start using the Chrome extension for subject-aware study assistance.'
        }
        actions={
          <>
            <Button asChild>
              <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                <Download className="h-4 w-4" />
                {`Download ZIP v${extensionVersion}`}
              </a>
            </Button>
            <Button asChild variant="secondary">
              <Link href="#before-you-start">Before You Start</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="#update-extension">Update Guide</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="#pair-extension-flow">{hasPairedDevice ? 'Pair Another Device' : 'Pair Now'}</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {isOutdatedInstalledVersion ? (
            <Card className="border-warning/25 bg-warning/10">
              <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Please update your extension</p>
                  <p className="text-sm text-muted-foreground">
                    {`Installed version ${installedVersion} is older than the latest ZIP v${extensionVersion} released on ${latestPackageDateLabel}. Download the latest ZIP, extract it to a new folder, then reload the unpacked extension in chrome://extensions.`}
                  </p>
                </div>
                <Button asChild>
                  <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                    <Download className="h-4 w-4" />
                    {`Update To v${extensionVersion}`}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className={hasPairedDevice ? 'border-success/25 bg-success/5' : 'border-warning/25 bg-warning/5'}>
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${hasPairedDevice ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                  {hasPairedDevice ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {hasPairedDevice ? 'Extension already connected' : 'No paired browser yet'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hasPairedDevice
                      ? `Latest active device: ${latestDevice?.name ?? 'Current browser'}${installedVersion ? ` | Installed ${installedVersion}` : ''}.`
                      : 'Download the ZIP, load it in Chrome, then generate a pairing code below to connect your browser.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={hasPairedDevice ? 'success' : 'warning'}>
                  {hasPairedDevice ? `${activeDevices.length} active device${activeDevices.length === 1 ? '' : 's'}` : 'Setup not finished'}
                </Badge>
                <Badge tone="accent">Latest ZIP v{extensionVersion}</Badge>
                <Badge tone={isOutdatedInstalledVersion ? 'warning' : 'success'}>
                  {installedVersion ? `Installed ${installedVersion}` : 'Installed version unknown'}
                </Badge>
                <Badge tone="neutral">{latestPackageDateLabel}</Badge>
                {isOutdatedInstalledVersion ? (
                  <Badge tone="warning">Update required</Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className={nextAction.toneClass}>
            <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{nextAction.eyebrow}</p>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{nextAction.title}</h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{nextAction.description}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  {nextAction.primary.download ? (
                    <a href={nextAction.primary.href} download={extensionDownloadFileName}>
                      <NextActionIcon className="h-4 w-4" />
                      {nextAction.primary.label}
                    </a>
                  ) : (
                    <a href={nextAction.primary.href}>
                      <NextActionIcon className="h-4 w-4" />
                      {nextAction.primary.label}
                    </a>
                  )}
                </Button>
                <Button asChild variant="secondary">
                  <a href={nextAction.secondary.href}>{nextAction.secondary.label}</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

          <Card className="overflow-hidden border-border/70 bg-background/70">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>At a glance</CardTitle>
                <CardDescription>
                  {`Latest ZIP v${extensionVersion} released ${latestPackageDateLabel}.`}
                </CardDescription>
              </div>
              <Badge tone={hasPairedDevice ? 'success' : 'warning'}>
                {hasPairedDevice ? 'Ready to extend setup' : 'First browser setup'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Step 1</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Download and extract the ZIP</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Save the current build from the portal, then extract it before you open Chrome extensions.
              </p>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Step 2</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Load the folder with manifest.json</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use <span className="font-mono text-foreground">chrome://extensions</span>, enable Developer mode, then choose the extracted folder.
              </p>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-background/50 p-4 sm:col-span-2 xl:col-span-1">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Step 3</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Generate a code and pair the browser</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use the pairing section below when the extension onboarding screen is open, then start a session and analyze a page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4">
          <ExtensionSetupProgress
            pairedDeviceCount={activeDevices.length}
            remainingSeconds={context.wallet.remaining_seconds}
            hasOpenSession={hasOpenSession}
          />
          <ExtensionInstallHelper appBaseUrl={env.NEXT_PUBLIC_APP_URL} />
        </div>
        <ExtensionGuideChecklist
          userId={context.userId}
          pairedDeviceCount={activeDevices.length}
          remainingSeconds={context.wallet.remaining_seconds}
          hasOpenSession={hasOpenSession}
        />
      </div>

      <GuideDisclosureCard
        id="before-you-start"
        title="Before you start"
        description="These are the few conditions that matter before install and pairing."
        defaultOpen={!hasPairedDevice}
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {beforeYouStartItems.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="rounded-[24px] border border-border/70 bg-background/50 p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            );
          })}
        </div>
      </GuideDisclosureCard>

      {hasPairedDevice ? (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-success/20 bg-success/5">
            <CardHeader className="pb-4">
              <CardTitle>Current connected browser state</CardTitle>
              <CardDescription>
                What the portal currently detects from your paired extension setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Paired devices</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{activeDevices.length}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {latestDevice ? `Latest active browser: ${latestDevice.name}` : 'No active browser found.'}
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Credits available</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{context.wallet.remaining_seconds > 0 ? 'Ready' : 'Blocked'}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {context.wallet.remaining_seconds > 0
                    ? 'The account can start a session and analyze pages.'
                    : 'Buy credits before using analyze from the extension.'}
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Last seen</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{latestDevice?.lastSeen ?? 'Never'}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use this to confirm which browser was active most recently.
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Session state</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{overview.openSession ? 'Active' : 'Not running'}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {overview.openSession
                    ? 'An open session already exists, so the extension can analyze immediately.'
                    : 'Start a session after opening the extension side panel.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Add another browser or reinstall cleanly</CardTitle>
              <CardDescription>
                Use the same ZIP distribution flow for a second browser, a new laptop, or a fresh install.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
                <p className="text-sm font-semibold text-foreground">Add another browser</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Download the latest ZIP, load it in the other browser, then use the pairing section below to generate a new short-lived code.
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
                <p className="text-sm font-semibold text-foreground">Update this browser later</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Download the latest ZIP from this page again, then use the update instructions section to reload or replace the unpacked folder.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                    <Download className="h-4 w-4" />
                    Download Latest ZIP
                  </a>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="#pair-extension-flow">Generate New Code</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader className="pb-4">
            <CardTitle>First-time setup path</CardTitle>
            <CardDescription>
              If this is your first browser, follow the steps in order: download, extract, load unpacked, then pair.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Phase 1</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Download and extract</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Save the ZIP, then extract it before opening Chrome extensions.
              </p>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Phase 2</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Load unpacked in Chrome</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Select the extracted folder that contains manifest.json.
              </p>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Phase 3</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Generate code and pair</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Use the pairing section below right after opening the extension.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <ExtensionInstallFlow pairedDeviceCount={activeDevices.length} />

      <GuideDisclosureCard
        id="update-extension"
        title="Update the extension later"
        description="Manual ZIP distribution means updates are also manual. Use the same page every time you need a newer build."
        defaultOpen={hasPairedDevice}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">Version {extensionVersion}</Badge>
            <Badge tone="neutral">Chrome {extensionMinimumChromeVersion}+</Badge>
            <Badge tone="neutral">{new Date(extensionPackageUpdatedAt).toLocaleString()}</Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {updateSteps.map((step, index) => (
              <div key={step} className="rounded-[24px] border border-border/70 bg-background/50 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Step {index + 1}</p>
                <p className="mt-2 text-sm text-foreground">{step}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] border border-warning/25 bg-warning/10 p-4">
            <p className="text-sm font-semibold text-foreground">Do not delete the extracted folder after install</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Unpacked extensions continue to read from the folder you selected. If that folder moves or disappears, Chrome can break the extension until you load it again.
            </p>
          </div>
        </div>
      </GuideDisclosureCard>

      <GuideDisclosureCard
        id="setup-steps"
        title="Detailed setup checklist"
        description="Use this if you want the exact click-by-click install and pairing flow."
        defaultOpen={!hasPairedDevice}
      >
        <div className="grid gap-3">
          {setupSteps.map((item) => (
            <div key={item.step} className="flex items-start gap-4 rounded-[24px] border border-border/70 bg-background/60 p-4">
              <Badge tone="accent" className="mt-0.5 shrink-0">{item.step}</Badge>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </GuideDisclosureCard>

      <GuideDisclosureCard
        id="troubleshooting"
        title="Troubleshooting"
        description="Common fixes grouped by install phase so you can jump to the right problem faster."
        defaultOpen={!hasPairedDevice}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {troubleshootingGroups.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge tone={group.tone}>{group.title}</Badge>
                </CardTitle>
                <CardDescription>
                  Common fixes for this part of the install and usage flow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.items.map((item) => (
                  <div key={item.problem} className="rounded-[22px] border border-border/70 bg-background/50 p-4">
                    <p className="text-sm font-medium text-foreground">{item.problem}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.solution}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </GuideDisclosureCard>

      <Card>
        <CardHeader>
          <CardTitle>Need more help?</CardTitle>
          <CardDescription>
            If the steps above do not solve the issue, use one of these next actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/contact">Contact Support</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/account#paired-devices">Manage Devices</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="#pair-extension-flow">
              Go To Pairing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <PairExtensionCard
        cardId="pair-extension-flow"
        appBaseUrl={env.NEXT_PUBLIC_APP_URL}
        initialDeviceName={`${context.profile.full_name.split(' ')[0] || 'My'} Study Device`}
        title={hasPairedDevice ? 'Generate a code for another browser' : 'Generate your first pairing code'}
        description={
          hasPairedDevice
            ? 'Create a new short-lived code when you want to add another browser or re-pair the current one.'
            : 'Create a short-lived code, then paste it into the extension onboarding page together with the app URL.'
        }
        pairedDeviceCount={activeDevices.length}
      />
    </div>
  );
}
