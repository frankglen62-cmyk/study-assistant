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
    <div className="space-y-10 pb-12">
      {/* Admin Welcome Hero - Brutalist Style */}
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between border-4 border-border bg-surface p-10 shadow-solid-lg overflow-hidden pattern-grid">
        <div className="space-y-4 relative z-10 bg-background/80 p-6 border-2 border-border backdrop-blur-none inline-block shadow-solid-sm">
          <Badge tone="accent" className="rounded-none border-2 border-border bg-accent text-black font-black uppercase tracking-widest">System Overview</Badge>
          <h1 className="font-display text-4xl lg:text-5xl font-black uppercase tracking-tighter text-foreground">
            Platform Dashboard
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg font-bold">
            MONITOR USAGE // PROCESSING HEALTH // CREDIT SALES // SUBJECT ADOPTION
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 relative z-10">
          <Button asChild variant="secondary" className="gap-2 h-14 px-8 rounded-none bg-background hover:bg-accent hover:text-black border-2 border-border shadow-solid-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-bold uppercase tracking-wider">
            <Link href="/admin/sources"><FileText className="h-5 w-5" /> Manage Sources</Link>
          </Button>
          <Button asChild variant="secondary" className="gap-2 h-14 px-8 rounded-none bg-background hover:bg-accent hover:text-black border-2 border-border shadow-solid-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-bold uppercase tracking-wider">
            <Link href="/admin/users"><Users className="h-5 w-5" /> View Users</Link>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-6 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <div key={metric.label} className="border-2 border-border bg-surface p-6 shadow-solid-sm relative overflow-hidden group hover:bg-background transition-colors">
            <div className="absolute top-0 right-0 w-8 h-8 border-l-2 border-b-2 border-border bg-accent group-hover:bg-foreground transition-colors" />
            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">{metric.label}</p>
            <p className="font-display text-4xl font-black">{metric.value}</p>
            {metric.delta && (
              <p className={`mt-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${metric.tone === 'accent' ? 'text-accent' : metric.tone === 'warning' ? 'text-warning' : 'text-muted-foreground'}`}>
                <span className="h-2 w-2 rounded-none bg-current" />
                {metric.delta}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="border-4 border-border bg-background shadow-solid-md flex flex-col">
          <div className="border-b-4 border-border p-6 bg-surface flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                <Activity className="h-6 w-6 text-accent" />
                System Activity Log
              </h2>
              <p className="text-sm font-bold text-muted-foreground mt-1 uppercase tracking-wider">Operational events worth attention.</p>
            </div>
          </div>
          <div className="p-6 flex-1 grid gap-4 bg-background">
            {dashboard.recentActivity.length === 0 ? (
              <div className="border-2 border-dashed border-border bg-surface p-8 text-center text-sm font-bold uppercase text-muted-foreground flex items-center justify-center min-h-[200px]">
                No recent activity recorded.
              </div>
            ) : (
              dashboard.recentActivity.map((item, i) => (
                <div key={i} className="group flex items-start gap-4 border-2 border-border bg-surface p-4 text-sm font-bold uppercase transition-all duration-200 hover:bg-accent hover:text-black hover:translate-x-1">
                  <div className="mt-1 h-3 w-3 bg-black shrink-0 border border-current" />
                  <span className="leading-snug">{item}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-4 border-border bg-background shadow-solid-md flex flex-col">
          <div className="border-b-4 border-border p-6 bg-surface flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-accent" />
                Telemetry Snapshot
              </h2>
              <p className="text-sm font-bold text-muted-foreground mt-1 uppercase tracking-wider">Detection, processing & routing health.</p>
            </div>
          </div>
          <div className="p-6 flex-1 grid gap-6 sm:grid-cols-2 bg-background">
            <div className="relative border-2 border-border bg-surface p-6 transition-all duration-200 hover:bg-accent hover:text-black group shadow-solid-sm">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-black/70 mb-3">Failed Detections</p>
              <p className="text-4xl font-display font-black">{`${Math.round(dashboard.lowConfidenceRate * 100)}%`}</p>
              {dashboard.lowConfidenceRate > 0.15 && (
                <Badge tone="danger" className="mt-4 rounded-none border-2 border-current bg-danger text-white font-bold uppercase"><AlertTriangle className="h-3 w-3 mr-2" />Threshold Break</Badge>
              )}
            </div>
            <div className="relative border-2 border-border bg-surface p-6 transition-all duration-200 hover:bg-accent hover:text-black group shadow-solid-sm">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-black/70 mb-3">Source Failures</p>
              <p className="text-4xl font-display font-black">{dashboard.sourceFailures}</p>
              {dashboard.sourceFailures === 0 && (
                <Badge tone="success" className="mt-4 rounded-none border-2 border-current bg-success text-white font-bold uppercase"><ShieldCheck className="h-3 w-3 mr-2" />Optimum</Badge>
              )}
            </div>
            <div className="relative border-2 border-border bg-surface p-6 transition-all duration-200 hover:bg-accent hover:text-black group shadow-solid-sm">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-black/70 mb-3">Primary Subject Load</p>
              <p className="text-3xl font-display font-black leading-tight break-words">{dashboard.mostUsedSubject || 'N/A'}</p>
            </div>
            <div className="relative border-2 border-border bg-surface p-6 transition-all duration-200 hover:bg-accent hover:text-black group shadow-solid-sm">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-black/70 mb-3">Webhook Delta Queue</p>
              <p className="text-4xl font-display font-black">0</p>
              <Badge tone="success" className="mt-4 rounded-none border-2 border-current bg-success text-white font-bold uppercase"><ShieldCheck className="h-3 w-3 mr-2" />Synchronized</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
