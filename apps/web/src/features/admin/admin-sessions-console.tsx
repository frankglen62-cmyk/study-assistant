'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, Filter, Users, Clock, Activity, BarChart3 } from 'lucide-react';

import { Badge, Button, Card, Input } from '@study-assistant/ui';

import { StatusBadge } from '@/components/status-badge';
import { AdminSessionDrilldownDrawer } from '@/features/admin/admin-session-drilldown-drawer';

interface SessionRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  siteDomain: string;
  pageTitle: string;
  pagePath: string;
  subject: string;
  category: string | null;
  duration: string;
  creditsUsed: string;
  analyzeCount: number;
  startedAt: string;
  endedAt: string | null;
  status: 'active' | 'paused' | 'ended' | 'timed_out' | 'no_credit' | 'no_match' | 'failed';
  suspiciousFlag: string;
  detectionMode: 'auto' | 'manual';
  noMatchCount: number;
}

interface MetricRow {
  label: string;
  value: string;
  delta: string;
  tone: 'accent' | 'success' | 'warning';
}

interface UserWithoutSessionRow {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
}

const metricIcons: Record<string, typeof Activity> = {
  'Live Sessions': Activity,
  'Clients With Sessions': Users,
  'Clients With No Sessions': Users,
  'Recent Billed Time': Clock,
};

function uniqueSorted(items: string[]) {
  return Array.from(new Set(items.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

export function AdminSessionsConsole({
  metrics,
  sessions,
  usersWithoutSessions,
}: {
  metrics: MetricRow[];
  sessions: SessionRow[];
  usersWithoutSessions: UserWithoutSessionRow[];
}) {
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SessionRow['status']>('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const clientOptions = useMemo(
    () => uniqueSorted(sessions.map((session) => `${session.userName}|||${session.userId}`)),
    [sessions],
  );
  const siteOptions = useMemo(() => uniqueSorted(sessions.map((session) => session.siteDomain)), [sessions]);
  const subjectOptions = useMemo(() => uniqueSorted(sessions.map((session) => session.subject)), [sessions]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sessions.filter((session) => {
      const matchesSearch =
        !query ||
        session.userName.toLowerCase().includes(query) ||
        session.userEmail.toLowerCase().includes(query) ||
        session.siteDomain.toLowerCase().includes(query) ||
        session.pageTitle.toLowerCase().includes(query) ||
        session.subject.toLowerCase().includes(query);
      const matchesClient = clientFilter === 'all' || session.userId === clientFilter;
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
      const matchesSite = siteFilter === 'all' || session.siteDomain === siteFilter;
      const matchesSubject = subjectFilter === 'all' || session.subject === subjectFilter;

      return matchesSearch && matchesClient && matchesStatus && matchesSite && matchesSubject;
    });
  }, [clientFilter, search, sessions, siteFilter, statusFilter, subjectFilter]);

  const selectedSession = filteredSessions.find((session) => session.id === selectedSessionId) ??
    sessions.find((session) => session.id === selectedSessionId) ??
    null;

  const toneMap: Record<string, string> = {
    accent: 'bg-accent/10 text-accent',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metricIcons[metric.label] ?? BarChart3;
          return (
            <div key={metric.label} className="rounded-2xl border border-border/40 bg-background p-6 shadow-card transition-all duration-300 hover:shadow-card-hover">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${toneMap[metric.tone] ?? toneMap.accent}`}>
                  {metric.delta}
                </span>
              </div>
              <p className="mt-4 font-display text-3xl text-foreground">{metric.value}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{metric.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border/40 bg-background p-5 shadow-card space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by client, email, site..."
              className="pl-10 h-10 bg-surface/30 text-sm"
            />
          </div>
          <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-4 xl:max-w-5xl">
            <select
              aria-label="Filter by client"
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-border/40 bg-surface/30 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/20 cursor-pointer"
            >
              <option value="all">All clients</option>
              {clientOptions.map((clientOption) => {
                const [clientName, clientId] = clientOption.split('|||');
                return (
                  <option key={clientId} value={clientId}>
                    {clientName}
                  </option>
                );
              })}
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-10 w-full appearance-none rounded-xl border border-border/40 bg-surface/30 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/20 cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
              <option value="timed_out">Timed out</option>
              <option value="no_credit">No credit</option>
              <option value="no_match">No match</option>
              <option value="failed">Failed</option>
            </select>
            <select
              aria-label="Filter by site"
              value={siteFilter}
              onChange={(event) => setSiteFilter(event.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-border/40 bg-surface/30 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/20 cursor-pointer"
            >
              <option value="all">All sites</option>
              {siteOptions.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by subject"
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-border/40 bg-surface/30 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/20 cursor-pointer"
            >
              <option value="all">All subjects</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{`${filteredSessions.length} visible session${filteredSessions.length === 1 ? '' : 's'}`}</Badge>
          <Badge tone="neutral">{`${new Set(filteredSessions.map((session) => session.userId)).size} client${new Set(filteredSessions.map((session) => session.userId)).size === 1 ? '' : 's'} in view`}</Badge>
          {search || clientFilter !== 'all' || statusFilter !== 'all' || siteFilter !== 'all' || subjectFilter !== 'all' ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSearch('');
                setClientFilter('all');
                setStatusFilter('all');
                setSiteFilter('all');
                setSubjectFilter('all');
              }}
            >
              Clear Filters
            </Button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/40 bg-background shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border/60 bg-surface/50">
              <tr>
                {['User', 'Site', 'Subject', 'Usage', 'Status', 'Signals', 'Actions'].map((column) => (
                  <th key={column} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-muted-foreground bg-surface/20">
                    No sessions match the current filters.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="transition-colors hover:bg-surface/30 group">
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{session.userName}</p>
                        <p className="text-xs text-muted-foreground">{session.userEmail}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{session.siteDomain}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{session.pageTitle}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{session.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.category ?? 'No category'}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">{session.creditsUsed}</p>
                        <p className="text-xs text-muted-foreground">{`${session.analyzeCount} analyze${session.analyzeCount === 1 ? '' : 's'} · ${session.startedAt}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-0.5">
                        <p className="text-sm text-foreground">{session.suspiciousFlag}</p>
                        <p className="text-xs text-muted-foreground">{`${session.detectionMode} · ${session.noMatchCount} no-match`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedSessionId(session.id)}>
                          Quick View
                        </Button>
                        <Link href={`/admin/users/${session.userId}/sessions`}>
                          <Button size="sm" variant="secondary">User Sessions</Button>
                        </Link>
                        <Link href={`/admin/sessions/${session.id}`}>
                          <Button size="sm" variant="secondary">Full Details</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Without Sessions */}
      <div className="rounded-2xl border border-border/40 bg-background p-6 shadow-card space-y-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Clients Without Sessions Yet</p>
          <p className="text-xs text-muted-foreground">
            These users are registered but have not started any billed extension session yet.
          </p>
        </div>
        {usersWithoutSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface/30 p-10 text-center text-sm text-muted-foreground">
            Every current client has at least one session record.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {usersWithoutSessions.map((user) => (
              <div key={user.id} className="group rounded-2xl border border-border/40 bg-background p-5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-muted-foreground">
                  <Users className="h-4 w-4" />
                </div>
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
                <p className="mt-3 text-xs text-muted-foreground">{`Joined ${user.joinedAt}`}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminSessionDrilldownDrawer
        session={selectedSession}
        onClose={() => setSelectedSessionId(null)}
        footer={
          selectedSession ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/users/${selectedSession.userId}/sessions`}>
                <Button variant="secondary">Open User Sessions</Button>
              </Link>
              <Link href={`/admin/sessions/${selectedSession.id}`}>
                <Button>Open Full Details</Button>
              </Link>
            </div>
          ) : null
        }
      />
    </div>
  );
}
