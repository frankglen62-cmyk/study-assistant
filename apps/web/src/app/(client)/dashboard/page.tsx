import Link from 'next/link';

import { formatDuration } from '@study-assistant/shared-utils';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress, cn } from '@study-assistant/ui';
import { ArrowRight, CreditCard, Download, History, Laptop, Play, Settings, ShieldCheck, Zap } from 'lucide-react';

import { MetricCard } from '@/components/metric-card';
import { PageHeading } from '@/components/page-heading';
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
      <div className="relative overflow-hidden rounded-[32px] border border-white/5 bg-gradient-to-br from-accent/20 via-surface/60 to-background/80 p-10 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-white/10">
        <div className="absolute right-0 top-0 h-[600px] w-[600px] -translate-y-20 translate-x-20 rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge tone="accent" className="mb-2 border-accent/20 bg-accent/20 font-semibold text-accent">Client Portal</Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-white drop-shadow-md lg:text-5xl">
              Welcome back, {context.profile.full_name?.split(' ')[0] || 'Student'}!
            </h1>
            <p className="max-w-xl text-lg font-medium leading-relaxed text-white/70">
              Your AI study assistant is ready. You have <strong className="text-white">{formatDuration(context.wallet.remaining_seconds)}</strong> of analysis time remaining on your account.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button asChild variant="secondary" className="h-12 rounded-xl border border-white/10 bg-surface/50 px-6 backdrop-blur">
              <Link href="/buy-credits">
                <CreditCard className="h-4 w-4" />
                Buy Credits
              </Link>
            </Button>
            <Button asChild className="h-12 rounded-xl px-8 shadow-[0_0_20px_rgba(var(--accent),0.4)] transition-all hover:bg-accent/90 hover:shadow-[0_0_30px_rgba(var(--accent),0.6)]">
              <Link href="/sessions">
                <Play className="h-4 w-4" />
                Start Session
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <MetricCard label="Remaining credits" value={formatDuration(context.wallet.remaining_seconds)} delta="Active balance" tone="success" />
        <MetricCard label="Used this week" value={formatDuration(dashboard.usedThisWeek)} delta="Across recent sessions" tone="neutral" />
        <MetricCard label="Last detected subject" value={dashboard.lastDetectedSubject || 'None yet'} delta="Latest recorded attempt" tone="accent" />
        <MetricCard label="Last used category" value={dashboard.lastUsedCategory || 'None yet'} delta="Latest recorded attempt" tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Wallet & Usage</CardTitle>
                  <CardDescription>Monitor your credit consumption and active balance.</CardDescription>
                </div>
                <Badge tone={remainingPercent < 15 ? 'danger' : 'success'} className="gap-1.5 px-3 py-1">
                  <Zap className="h-3.5 w-3.5" />
                  {remainingPercent < 15 ? 'Low Credits' : 'Healthy Balance'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="font-display text-3xl font-semibold tracking-tight">
                    {formatDuration(context.wallet.remaining_seconds)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{Math.round(remainingPercent)}% remaining</span>
                </div>
                <Progress value={remainingPercent} className={cn('h-3', remainingPercent < 15 && 'bg-destructive/20 *:[data-state=indeterminate]:bg-destructive *:[data-state=default]:bg-destructive')} />
              </div>

              <div className="rounded-[22px] border border-border/70 bg-background/40 p-5">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <History className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Session Status</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75', dashboard.sessionStatus === 'active' ? 'bg-success animate-ping' : 'bg-muted-foreground')} />
                        <span className={cn('relative inline-flex h-2 w-2 rounded-full', dashboard.sessionStatus === 'active' ? 'bg-success' : 'bg-muted-foreground')} />
                      </span>
                      <p className="text-sm capitalize text-muted-foreground">{dashboard.sessionStatus.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button asChild variant="secondary" className="w-full">
                    <Link href="/sessions">Manage Session</Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full">
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

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 pb-1">
                    <Laptop className="h-4 w-4" />
                    Extension Access
                  </CardTitle>
                  <CardDescription>See the paired state, current ZIP version, and the fastest extension actions from the dashboard.</CardDescription>
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
              <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Current browser status</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {dashboard.latestActiveDevice?.name ?? 'No browser paired yet'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dashboard.latestActiveDevice
                    ? `Installed ${dashboard.latestActiveDevice.version ?? 'unknown version'} | Last seen ${dashboard.latestActiveDevice.lastSeen}`
                    : 'Download the ZIP, load it in Chrome, then use Pairing Mode to connect the browser.'}
                </p>
              </div>

              <div className="grid gap-2">
                <a
                  href={extensionDownloadPath}
                  download={extensionDownloadFileName}
                  className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3 text-sm transition hover:bg-muted/50"
                >
                  <span className="flex items-center gap-3 font-medium text-foreground">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    {`Download latest ZIP v${extensionVersion}`}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                </a>
                <Link href="/extension-guide" className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3 text-sm transition hover:bg-muted/50">
                  <span className="flex items-center gap-3 font-medium text-foreground">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Open simplified extension guide
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                </Link>
                <Link href="/account" className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3 text-sm transition hover:bg-muted/50">
                  <span className="flex items-center gap-3 font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    Review paired browsers
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
