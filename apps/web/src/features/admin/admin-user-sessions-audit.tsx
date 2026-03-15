'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';

import { Badge, Button, Card, Input } from '@study-assistant/ui';

import { StatusBadge } from '@/components/status-badge';
import { AdminSessionDrilldownDrawer } from '@/features/admin/admin-session-drilldown-drawer';

interface UserSessionRow {
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

function uniqueSorted(items: string[]) {
  return Array.from(new Set(items.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function AdminUserSessionsAudit({
  userId,
  userName,
  sessions,
}: {
  userId: string;
  userName: string;
  sessions: UserSessionRow[];
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserSessionRow['status']>('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const siteOptions = useMemo(() => uniqueSorted(sessions.map((session) => session.siteDomain)), [sessions]);
  const subjectOptions = useMemo(() => uniqueSorted(sessions.map((session) => session.subject)), [sessions]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sessions.filter((session) => {
      const matchesSearch =
        !query ||
        session.siteDomain.toLowerCase().includes(query) ||
        session.pageTitle.toLowerCase().includes(query) ||
        session.pagePath.toLowerCase().includes(query) ||
        session.subject.toLowerCase().includes(query) ||
        (session.category ?? '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
      const matchesSite = siteFilter === 'all' || session.siteDomain === siteFilter;
      const matchesSubject = subjectFilter === 'all' || session.subject === subjectFilter;

      return matchesSearch && matchesStatus && matchesSite && matchesSubject;
    });
  }, [search, sessions, siteFilter, statusFilter, subjectFilter]);

  const selectedSession =
    filteredSessions.find((session) => session.id === selectedSessionId) ??
    sessions.find((session) => session.id === selectedSessionId) ??
    null;

  function handleExportCsv() {
    const header = [
      'Session ID',
      'Started At',
      'Ended At',
      'Status',
      'Site Domain',
      'Page Title',
      'Page Path',
      'Subject',
      'Category',
      'Credits Used',
      'Analyze Count',
      'Detection Mode',
      'No Match Count',
      'Suspicious Flag',
    ];

    const rows = filteredSessions.map((session) => [
      session.id,
      session.startedAt,
      session.endedAt ?? '',
      session.status,
      session.siteDomain,
      session.pageTitle,
      session.pagePath,
      session.subject,
      session.category ?? '',
      session.creditsUsed,
      session.analyzeCount,
      session.detectionMode,
      session.noMatchCount,
      session.suspiciousFlag,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeUserName = userName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || userId;

    link.href = url;
    link.download = `${safeUserName}-sessions-audit.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by site, page title, path, subject, or category..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleExportCsv} disabled={filteredSessions.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            {search || statusFilter !== 'all' || siteFilter !== 'all' || subjectFilter !== 'all' ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch('');
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

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
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
          <div className="flex items-center gap-2">
            <Badge tone="accent">{`${filteredSessions.length} session${filteredSessions.length === 1 ? '' : 's'}`}</Badge>
            <Badge tone="neutral">{`${new Set(filteredSessions.map((session) => session.siteDomain)).size} site${new Set(filteredSessions.map((session) => session.siteDomain)).size === 1 ? '' : 's'}`}</Badge>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/70 text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Started', 'Site', 'Subject', 'Billed Time', 'Status', 'Signals', 'Actions'].map((column) => (
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
                    No sessions match the current filters for this client.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="bg-surface/70 transition hover:bg-muted/30">
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{session.startedAt}</p>
                        <p className="text-xs text-muted-foreground">{session.endedAt ? `Ended ${session.endedAt}` : 'Still open'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{session.siteDomain}</p>
                        <p className="text-xs text-muted-foreground">{session.pagePath}</p>
                        <p className="text-xs text-muted-foreground">{session.pageTitle}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{session.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.category ? `Category: ${session.category}` : 'No category recorded'}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{session.creditsUsed}</p>
                        <p className="text-xs text-muted-foreground">{`${session.analyzeCount} analyze${session.analyzeCount === 1 ? '' : 's'}`}</p>
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

      <AdminSessionDrilldownDrawer
        session={selectedSession}
        onClose={() => setSelectedSessionId(null)}
        footer={
          selectedSession ? (
            <div className="flex flex-wrap gap-2">
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
