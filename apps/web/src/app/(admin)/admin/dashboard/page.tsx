import Link from 'next/link';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';
import { Activity, AlertTriangle, FileText, ShieldCheck, Users, TrendingUp } from 'lucide-react';

import { MetricCard } from '@/components/metric-card';
import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { getAdminDashboardPageData } from '@/features/admin/server';

export default async function AdminDashboardPage() {
  await requirePageUser(['admin', 'super_admin']);
  const dashboard = await getAdminDashboardPageData();

  return (
    <div className="space-y-8 pb-12">
      {/* Admin Welcome Hero */}
      <div className="relative overflow-hidden flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between rounded-[32px] border border-white/5 bg-gradient-to-br from-accent/10 via-surface/60 to-background/80 p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-[500px] h-[500px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="space-y-4 relative z-10">
          <Badge tone="accent" className="bg-accent/20 text-accent font-semibold border-accent/20">Admin Overview</Badge>
          <h1 className="font-display text-4xl lg:text-5xl font-semibold tracking-tight text-foreground">
            Platform Dashboard
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
            Monitor usage, processing health, credit sales, and subject adoption across the platform in real-time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <Button asChild variant="secondary" className="gap-2 h-11 px-5 rounded-xl bg-surface/50 hover:bg-surface/80 border border-white/10 backdrop-blur">
            <Link href="/admin/sources"><FileText className="h-4 w-4" /> Manage Sources</Link>
          </Button>
          <Button asChild variant="secondary" className="gap-2 h-11 px-5 rounded-xl bg-surface/50 hover:bg-surface/80 border border-white/10 backdrop-blur">
            <Link href="/admin/users"><Users className="h-4 w-4" /> View Users</Link>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-6 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} delta={metric.delta} tone={metric.tone} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              Recent Activity
            </CardTitle>
            <CardDescription>Operational events worth immediate admin attention.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dashboard.recentActivity.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
                No recent activity has been recorded yet.
              </div>
            ) : (
              dashboard.recentActivity.map((item) => (
                <div key={item} className="group flex items-center gap-3 rounded-[18px] border border-border/50 bg-background/40 px-4 py-3 text-sm text-muted-foreground transition-all duration-200 hover:bg-muted/30 hover:border-border/80 hover:text-foreground">
                  <div className="h-2 w-2 rounded-full bg-accent/60 shrink-0" />
                  {item}
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Health Snapshot
            </CardTitle>
            <CardDescription>High-level signals for detections, source processing, and payment throughput.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-[20px] border border-border/50 bg-background/40 p-5 transition-all duration-300 hover:bg-background/60 hover:border-border/80">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-20 h-20 bg-danger/10 blur-[30px] rounded-full pointer-events-none" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">Failed Detections</p>
              <p className="text-3xl font-display font-bold tracking-tight">{`${Math.round(dashboard.lowConfidenceRate * 100)}%`}</p>
              {dashboard.lowConfidenceRate > 0.15 && (
                <Badge tone="danger" className="mt-2 gap-1"><AlertTriangle className="h-3 w-3" />Above threshold</Badge>
              )}
            </div>
            <div className="relative overflow-hidden rounded-[20px] border border-border/50 bg-background/40 p-5 transition-all duration-300 hover:bg-background/60 hover:border-border/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">Source Failures</p>
              <p className="text-3xl font-display font-bold tracking-tight">{dashboard.sourceFailures}</p>
              {dashboard.sourceFailures === 0 && (
                <Badge tone="success" className="mt-2 gap-1"><ShieldCheck className="h-3 w-3" />All clear</Badge>
              )}
            </div>
            <div className="relative overflow-hidden rounded-[20px] border border-border/50 bg-background/40 p-5 transition-all duration-300 hover:bg-background/60 hover:border-border/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">Most Used Subject</p>
              <p className="text-3xl font-display font-bold tracking-tight">{dashboard.mostUsedSubject}</p>
            </div>
            <div className="relative overflow-hidden rounded-[20px] border border-border/50 bg-background/40 p-5 transition-all duration-300 hover:bg-background/60 hover:border-border/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">Webhook Backlog</p>
              <p className="text-3xl font-display font-bold tracking-tight">0</p>
              <Badge tone="success" className="mt-2 gap-1"><ShieldCheck className="h-3 w-3" />All clear</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
