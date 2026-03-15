import Link from 'next/link';

import { formatDuration } from '@study-assistant/shared-utils';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress, cn } from '@study-assistant/ui';
import { Play, CreditCard, Laptop, Settings, ArrowRight, ShieldCheck, Zap, History, Download } from 'lucide-react';

import { MetricCard } from '@/components/metric-card';
import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { env } from '@/lib/env/server';
import { extensionDownloadFileName, extensionDownloadPath } from '@/lib/extension-distribution';
import { PairExtensionCard } from '@/features/client/pair-extension-card';
import { getClientDashboardData } from '@/features/client/server';

export default async function ClientDashboardPage() {
  const context = await requirePageUser(['client']);
  const dashboard = await getClientDashboardData(context.userId);
  const remainingPercent = Math.min((context.wallet.remaining_seconds / 18000) * 100, 100);

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Hero */}
      <div className="relative overflow-hidden flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between rounded-[32px] border border-white/5 bg-gradient-to-br from-accent/20 via-surface/60 to-background/80 p-10 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-white/10">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-accent/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="space-y-4 relative z-10">
          <Badge tone="accent" className="mb-2 bg-accent/20 text-accent font-semibold border-accent/20">Client Portal</Badge>
          <h1 className="font-display text-4xl lg:text-5xl font-semibold tracking-tight text-white drop-shadow-md">
            Welcome back, {context.profile.full_name?.split(' ')[0] || 'Student'}!
          </h1>
          <p className="text-white/70 max-w-xl text-lg font-medium leading-relaxed">
            Your AI study assistant is ready. You have <strong className="text-white">{formatDuration(context.wallet.remaining_seconds)}</strong> of analysis time remaining on your account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 relative z-10">
          <Button asChild variant="secondary" className="gap-2 h-12 px-6 rounded-xl bg-surface/50 hover:bg-surface/80 border border-white/10 backdrop-blur">
            <Link href="/buy-credits"><CreditCard className="h-4 w-4" /> Buy Credits</Link>
          </Button>
          <Button asChild className="gap-2 h-12 px-8 rounded-xl bg-accent text-accent-foreground shadow-[0_0_20px_rgba(var(--accent),0.4)] hover:shadow-[0_0_30px_rgba(var(--accent),0.6)] hover:bg-accent/90 transition-all">
            <Link href="/sessions"><Play className="h-4 w-4" /> Start Session</Link>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-6 xl:grid-cols-4">
        <MetricCard label="Remaining credits" value={formatDuration(context.wallet.remaining_seconds)} delta="Active balance" tone="success" />
        <MetricCard label="Used this week" value={formatDuration(dashboard.usedThisWeek)} delta="Across recent sessions" tone="neutral" />
        <MetricCard label="Last detected subject" value={dashboard.lastDetectedSubject || 'None yet'} delta="Latest recorded attempt" tone="accent" />
        <MetricCard label="Last used category" value={dashboard.lastUsedCategory || 'None yet'} delta="Latest recorded attempt" tone="warning" />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        
        {/* Wallet & Session Overview */}
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
                  <span className="text-3xl font-display font-semibold tracking-tight">
                    {formatDuration(context.wallet.remaining_seconds)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{Math.round(remainingPercent)}% remaining</span>
                </div>
                <Progress value={remainingPercent} className={cn("h-3", remainingPercent < 15 && "bg-destructive/20 *:[data-state=indeterminate]:bg-destructive *:[data-state=default]:bg-destructive")} />
              </div>
              
              <div className="rounded-[22px] border border-border/70 bg-background/40 p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <History className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Session Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="relative flex h-2 w-2">
                        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", dashboard.sessionStatus === 'active' ? "bg-success animate-ping" : "bg-muted-foreground")} />
                        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dashboard.sessionStatus === 'active' ? "bg-success" : "bg-muted-foreground")} />
                      </span>
                      <p className="text-sm text-muted-foreground capitalize">{dashboard.sessionStatus.replace('_', ' ')}</p>
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

        {/* Quick Actions & Extension Status */}
        <div className="space-y-6">
          <PairExtensionCard
            appBaseUrl={env.NEXT_PUBLIC_APP_URL}
            initialDeviceName={`${context.profile.full_name.split(' ')[0] || 'My'} Study Device`}
          />
          
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 pb-1">
                <Laptop className="h-4 w-4" /> Quick Actions
              </CardTitle>
              <CardDescription>Use the same install, pairing, and account actions that appear in the extension guide.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <a
                href={extensionDownloadPath}
                download={extensionDownloadFileName}
                className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3 text-sm transition hover:bg-muted/50"
              >
                <span className="flex items-center gap-3 font-medium text-foreground"><Download className="h-4 w-4 text-muted-foreground" /> Download latest extension ZIP</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
              </a>
              <Link href="/extension-guide" className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3 text-sm transition hover:bg-muted/50">
                <span className="flex items-center gap-3 font-medium text-foreground"><Settings className="h-4 w-4 text-muted-foreground" /> Open extension setup guide</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
              </Link>
              <Link href="/account" className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3 text-sm transition hover:bg-muted/50">
                <span className="flex items-center gap-3 font-medium text-foreground"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> Review paired browsers</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
              </Link>
            </CardContent>
          </Card>
        </div>
        
      </div>
    </div>
  );
}
