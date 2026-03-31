'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="space-y-2 flex flex-col justify-between p-6">
            <p className="text-xs font-medium text-foreground">{metric.label}</p>
            <p className="font-display text-5xl font-black tracking-tighter text-black">{metric.value}</p>
            <div className="inline-flex w-fit items-center border border-border/40 bg-accent px-2 py-0.5 text-xs font-medium text-black shadow-card">
              {metric.delta}
            </div>
          </Card>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="SEARCH BY CLIENT, EMAIL, SITE..."
              className="pl-12"
            />
          </div>
          <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-4 xl:max-w-5xl">
            <select
              aria-label="Filter by client"
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl rounded-xl border border-border/40 bg-surface/30 px-4 py-2 text-xs font-medium text-black outline-none transition focus:border-accent focus:shadow-card cursor-pointer"
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
              className="h-11 w-full appearance-none rounded-xl rounded-xl border border-border/40 bg-surface/30 px-4 py-2 text-xs font-medium text-black outline-none transition focus:border-accent focus:shadow-card cursor-pointer"
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
              className="h-11 w-full appearance-none rounded-xl rounded-xl border border-border/40 bg-surface/30 px-4 py-2 text-xs font-medium text-black outline-none transition focus:border-accent focus:shadow-card cursor-pointer"
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
              className="h-11 w-full appearance-none rounded-xl rounded-xl border border-border/40 bg-surface/30 px-4 py-2 text-xs font-medium text-black outline-none transition focus:border-accent focus:shadow-card cursor-pointer"
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
      </Card>

      <div className="rounded-2xl border border-border/40 bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm border-collapse">
            <thead className="bg-surface border-b-4 border-black">
              <tr>
                {['User', 'Site', 'Subject', 'Usage', 'Status', 'Signals', 'Actions'].map((column) => (
                  <th key={column} className="px-5 py-4 font-medium text-black ">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-border font-medium">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-muted-foreground font-medium bg-surface/50">
                    No sessions match the current filters.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="bg-background transition-colors hover:bg-accent/10 group">
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <div className="space-y-1">
                        <p className="font-bold text-base text-foreground group-hover:text-black">{session.userName}</p>
                        <p className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground/80">{session.userEmail}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <div className="space-y-1">
                        <p className="font-bold text-base text-foreground group-hover:text-black">{session.siteDomain}</p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">{session.pageTitle}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <div className="space-y-1">
                        <p className="font-bold text-base text-foreground group-hover:text-black">{session.subject}</p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">
                          {session.category ? `${session.category} category` : 'No category assigned'}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <div className="space-y-1">
                        <p className="font-display font-black text-lg text-foreground group-hover:text-black">{session.creditsUsed}</p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">{`${session.analyzeCount} analyze${session.analyzeCount === 1 ? '' : 's'} | ${session.startedAt}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <div className="space-y-1">
                        <p className="font-bold text-base text-foreground group-hover:text-black">{session.suspiciousFlag}</p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">{`${session.detectionMode} detection | ${session.noMatchCount} no-match event${session.noMatchCount === 1 ? '' : 's'}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top border-r-2 border-border/50">
                      <div className="flex flex-wrap gap-2">
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

      <Card className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Clients Without Sessions Yet</p>
          <p className="text-xs font-medium text-muted-foreground">
            These users are registered but have not started any billed extension session yet, so they will not appear in the session table above.
          </p>
        </div>
        {usersWithoutSessions.length === 0 ? (
          <div className="border border-border/40 border-dashed bg-surface p-6 sm:p-12 text-center text-xs font-medium text-muted-foreground">
            Every current client has at least one session record.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {usersWithoutSessions.map((user) => (
              <div key={user.id} className="rounded-none rounded-xl border border-border/40 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:translate-x-1 hover:shadow-card group cursor-default">
                <p className="font-medium text-black/80 group-hover:text-black">{user.name}</p>
                <p className="mt-1 text-xs font-mono font-bold text-black/60 group-hover:text-black/80">{user.email}</p>
                <p className="mt-4 text-xs font-medium text-black/50 group-hover:text-black/80">{`Joined ${user.joinedAt}`}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

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
