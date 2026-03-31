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
      <div className="relative overflow-hidden border-4 border-black bg-accent p-8 shadow-solid-xl sm:p-12 mb-12">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge tone="neutral" className="mb-2 bg-black text-white border-black shadow-none">Client Portal</Badge>
            <h1 className="font-display text-4xl font-black uppercase tracking-tighter text-black lg:text-6xl">
              Welcome back, {context.profile.full_name?.split(' ')[0] || 'Student'}!
            </h1>
            <p className="max-w-xl text-sm font-bold uppercase tracking-widest text-black/80">
              Your AI study assistant is ready. You have <strong className="text-black">{formatDuration(context.wallet.remaining_seconds)}</strong> of analysis time remaining on your account.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button asChild variant="secondary" className="h-14 px-8 text-base">
              <Link href="/buy-credits">
                <CreditCard className="mr-2 h-5 w-5" />
                Buy Credits
              </Link>
            </Button>
            <Button asChild className="h-14 px-8 text-base bg-black text-white hover:bg-surface hover:text-black hover:border-black">
              <Link href="/sessions">
                <Play className="mr-2 h-5 w-5" />
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
                <div className="flex items-end justify-between border-b-4 border-black pb-4">
                  <span className="font-display text-4xl font-black uppercase tracking-tighter text-black">
                    {formatDuration(context.wallet.remaining_seconds)}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/60">{Math.round(remainingPercent)}% remaining</span>
                </div>
                <Progress value={remainingPercent} className={cn('h-6', remainingPercent < 15 && 'bg-danger *:[data-state=indeterminate]:bg-white *:[data-state=default]:bg-white')} />
              </div>

              <div className="border-4 border-black bg-accent/10 p-6">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center border-4 border-black bg-accent">
                    <History className="h-6 w-6 text-black" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Session Status</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="relative flex h-3 w-3 border-2 border-black">
                        <span className={cn('absolute inline-flex h-full w-full opacity-75', dashboard.sessionStatus === 'active' ? 'bg-success animate-ping' : 'bg-muted-foreground')} />
                        <span className={cn('relative inline-flex h-full w-full', dashboard.sessionStatus === 'active' ? 'bg-success' : 'bg-muted-foreground')} />
                      </span>
                      <p className="text-sm font-bold uppercase tracking-widest text-black/70 capitalize">{dashboard.sessionStatus.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
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
            <CardContent className="space-y-6">
              <div className="border-4 border-black bg-warning p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-black">Current browser status</p>
                <p className="mt-2 text-2xl font-black uppercase text-black">
                  {dashboard.latestActiveDevice?.name ?? 'No browser paired yet'}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-black/70">
                  {dashboard.latestActiveDevice
                    ? `Installed ${dashboard.latestActiveDevice.version ?? 'unknown version'} | Last seen ${dashboard.latestActiveDevice.lastSeen}`
                    : 'Download the ZIP, load it in Chrome, then use Pairing Mode to connect the browser.'}
                </p>
              </div>

              <div className="grid gap-3">
                <a
                  href={extensionDownloadPath}
                  download={extensionDownloadFileName}
                  className="group flex items-center justify-between border-4 border-black bg-surface p-4 text-xs font-bold uppercase tracking-widest text-black shadow-solid-sm hover:-translate-y-1 hover:translate-x-1 hover:shadow-solid-md transition-all"
                >
                  <span className="flex items-center gap-3">
                    <Download className="h-4 w-4" />
                    {`Download latest ZIP v${extensionVersion}`}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link href="/extension-guide" className="group flex items-center justify-between border-4 border-black bg-surface p-4 text-xs font-bold uppercase tracking-widest text-black shadow-solid-sm hover:-translate-y-1 hover:translate-x-1 hover:shadow-solid-md transition-all">
                  <span className="flex items-center gap-3">
                    <Settings className="h-4 w-4" />
                    Open extension guide
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/account" className="group flex items-center justify-between border-4 border-black bg-surface p-4 text-xs font-bold uppercase tracking-widest text-black shadow-solid-sm hover:-translate-y-1 hover:translate-x-1 hover:shadow-solid-md transition-all">
                  <span className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4" />
                    Review paired browsers
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
