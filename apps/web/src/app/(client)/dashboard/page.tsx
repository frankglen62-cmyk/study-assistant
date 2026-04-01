import Link from 'next/link';

import { formatDuration } from '@study-assistant/shared-utils';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress, cn } from '@study-assistant/ui';
import { ArrowRight, CreditCard, Download, History, Laptop, Play, Settings, ShieldCheck, Zap } from 'lucide-react';

import { PairExtensionCard } from '@/features/client/pair-extension-card';
import { getClientDashboardData } from '@/features/client/server';
import { requirePageUser } from '@/lib/auth/page-context';
import { env } from '@/lib/env/server';
import { extensionDownloadFileName, extensionDownloadPath, extensionVersion } from '@/lib/extension-distribution';

export default async function ClientDashboardPage() {
  const context = await requirePageUser(['client']);
  const dashboard = await getClientDashboardData(context.userId);
  const remainingPercent = Math.min((context.wallet.remaining_seconds / 18000) * 100, 100);

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-accent/10 via-emerald-50/50 to-blue-50/30 dark:from-accent/5 dark:via-accent/5 dark:to-transparent p-8 sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge tone="accent">Client Portal</Badge>
            <h1 className="font-display text-3xl text-foreground lg:text-4xl">
              Welcome back, {context.profile.full_name?.split(' ')[0] || 'Student'}!
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Your AI study assistant is ready. You have <strong className="text-foreground">{formatDuration(context.wallet.remaining_seconds)}</strong> of analysis time remaining.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="secondary" size="sm">
              <Link href="/buy-credits">
                <CreditCard className="h-4 w-4" />
                Buy Credits
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sessions">
                <Play className="h-4 w-4" />
                Start Session
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/40 bg-background p-5 shadow-card">
          <p className="text-xs font-medium text-muted-foreground mb-2">Remaining Credits</p>
          <p className="text-2xl font-semibold text-foreground">{formatDuration(context.wallet.remaining_seconds)}</p>
          <p className="mt-2 text-xs text-accent font-medium flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Active balance
          </p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-background p-5 shadow-card">
          <p className="text-xs font-medium text-muted-foreground mb-2">Used This Week</p>
          <p className="text-2xl font-semibold text-foreground">{formatDuration(dashboard.usedThisWeek)}</p>
          <p className="mt-2 text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            Across recent sessions
          </p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-background p-5 shadow-card">
          <p className="text-xs font-medium text-muted-foreground mb-2">Last Detected Subject</p>
          <p className="text-lg font-semibold text-foreground leading-tight">{dashboard.lastDetectedSubject || 'None yet'}</p>
          <p className="mt-2 text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Latest attempt
          </p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-background p-5 shadow-card">
          <p className="text-xs font-medium text-muted-foreground mb-2">Last Used Category</p>
          <p className="text-lg font-semibold text-foreground leading-tight">{dashboard.lastUsedCategory || 'None yet'}</p>
          <p className="mt-2 text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Latest attempt
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Wallet & Usage Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Wallet & Usage</CardTitle>
                  <CardDescription>Monitor your credit consumption and active balance.</CardDescription>
                </div>
                <Badge tone={remainingPercent < 15 ? 'danger' : 'success'} className="gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  {remainingPercent < 15 ? 'Low Credits' : 'Healthy Balance'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-semibold text-foreground">
                    {formatDuration(context.wallet.remaining_seconds)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{Math.round(remainingPercent)}% remaining</span>
                </div>
                <Progress value={remainingPercent} className={cn('h-3', remainingPercent < 15 && '[&>div]:bg-danger')} />
              </div>

              <div className="rounded-xl border border-border/40 bg-surface/50 dark:bg-surface p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                    <History className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Session Status</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        {dashboard.sessionStatus === 'active' && (
                          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                        )}
                        <span className={cn('relative inline-flex h-full w-full rounded-full', dashboard.sessionStatus === 'active' ? 'bg-accent' : 'bg-muted-foreground/40')} />
                      </span>
                      <p className="text-sm font-medium text-foreground capitalize">{dashboard.sessionStatus.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button asChild variant="secondary" size="sm" className="w-full">
                    <Link href="/sessions">Manage Session</Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm" className="w-full">
                    <Link href="/usage-logs">View Logs</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <PairExtensionCard
            appBaseUrl={env.NEXT_PUBLIC_APP_URL}
            initialDeviceName={`${context.profile.full_name.split(' ')[0] || 'My'} Study Device`}
            pairedDeviceCount={dashboard.activeDeviceCount}
            latestInstalledVersion={dashboard.latestActiveDevice?.version ?? null}
          />

          {/* Extension Access Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Laptop className="h-4 w-4" />
                    Extension Access
                  </CardTitle>
                  <CardDescription>Paired state, ZIP version, and quick actions.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={dashboard.activeDeviceCount > 0 ? 'success' : 'warning'}>
                    {dashboard.activeDeviceCount > 0 ? 'Paired' : 'Not paired'}
                  </Badge>
                  <Badge tone="accent">{`ZIP v${extensionVersion}`}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/40 bg-amber-50/50 dark:bg-amber-500/10 dark:border-amber-500/20 p-4">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Current browser status</p>
                <p className="text-base font-semibold text-foreground">
                  {dashboard.latestActiveDevice?.name ?? 'No browser paired yet'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dashboard.latestActiveDevice
                    ? `Installed ${dashboard.latestActiveDevice.version ?? 'unknown version'} • Last seen ${dashboard.latestActiveDevice.lastSeen}`
                    : 'Download the ZIP, load it in Chrome, then use Pairing Mode to connect.'}
                </p>
              </div>

              <div className="space-y-2">
                <a
                  href={extensionDownloadPath}
                  download={extensionDownloadFileName}
                  className="group flex items-center justify-between rounded-xl border border-border/40 bg-background p-3.5 text-sm font-medium text-foreground shadow-soft-sm transition-all hover:shadow-soft-md hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-2.5">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    {`Download latest ZIP v${extensionVersion}`}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </a>
                <Link href="/extension-guide" className="group flex items-center justify-between rounded-xl border border-border/40 bg-background p-3.5 text-sm font-medium text-foreground shadow-soft-sm transition-all hover:shadow-soft-md hover:-translate-y-0.5">
                  <span className="flex items-center gap-2.5">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Open extension guide
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link href="/settings" className="group flex items-center justify-between rounded-xl border border-border/40 bg-background p-3.5 text-sm font-medium text-foreground shadow-soft-sm transition-all hover:shadow-soft-md hover:-translate-y-0.5">
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    Review paired browsers
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
