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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
            <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>
            <p className="text-xs text-muted-foreground">{metric.delta}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by client, email, site, page title, or subject..."
              className="pl-9"
            />
          </div>
          <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-4 xl:max-w-5xl">
            <select
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="h-11 rounded-2xl border border-input bg-background/60 px-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
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
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-11 rounded-2xl border border-input bg-background/60 px-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
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
              value={siteFilter}
              onChange={(event) => setSiteFilter(event.target.value)}
              className="h-11 rounded-2xl border border-input bg-background/60 px-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="all">All sites</option>
              {siteOptions.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
            <select
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              className="h-11 rounded-2xl border border-input bg-background/60 px-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
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

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/70 text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['User', 'Site', 'Subject', 'Usage', 'Status', 'Signals', 'Actions'].map((column) => (
                  <th key={column} className="px-5 py-4 font-medium text-muted-foreground">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                    No sessions match the current filters.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="bg-surface/70 transition hover:bg-muted/30">
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{session.userName}</p>
                        <p className="text-xs text-muted-foreground">{session.userEmail}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{session.siteDomain}</p>
                        <p className="text-xs text-muted-foreground">{session.pageTitle}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{session.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.category ? `${session.category} category` : 'No category assigned'}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{session.creditsUsed}</p>
                        <p className="text-xs text-muted-foreground">{`${session.analyzeCount} analyze${session.analyzeCount === 1 ? '' : 's'} | ${session.startedAt}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{session.suspiciousFlag}</p>
                        <p className="text-xs text-muted-foreground">{`${session.detectionMode} detection | ${session.noMatchCount} no-match event${session.noMatchCount === 1 ? '' : 's'}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
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
      </Card>

      <Card className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.18em] text-accent">Clients Without Sessions Yet</p>
          <p className="text-sm text-muted-foreground">
            These users are registered but have not started any billed extension session yet, so they will not appear in the session table above.
          </p>
        </div>
        {usersWithoutSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every current client has at least one session record.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {usersWithoutSessions.map((user) => (
              <div key={user.id} className="rounded-3xl border border-border/70 bg-surface/60 p-4">
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="mt-2 text-xs text-muted-foreground">{`Joined ${user.joinedAt}`}</p>
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
