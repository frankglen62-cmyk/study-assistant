'use client';

import { X } from 'lucide-react';

import { Button, Card } from '@study-assistant/ui';

import { StatusBadge } from '@/components/status-badge';

interface DrawerSessionSummary {
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
  status: string;
  suspiciousFlag: string;
  detectionMode: string;
  noMatchCount: number;
}

export function AdminSessionDrilldownDrawer({
  session,
  onClose,
  footer,
}: {
  session: DrawerSessionSummary | null;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  if (!session) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/55 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border/70 bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.18em] text-accent">Quick Session View</p>
            <h3 className="text-2xl font-semibold tracking-tight">{session.userName}</h3>
            <p className="text-sm text-muted-foreground">{session.userEmail}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Card className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
            <StatusBadge status={session.status} />
            <p className="text-xs text-muted-foreground">{session.suspiciousFlag}</p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Billing</p>
            <p className="text-xl font-semibold">{session.creditsUsed}</p>
            <p className="text-xs text-muted-foreground">{`${session.analyzeCount} analyze attempt${session.analyzeCount === 1 ? '' : 's'}`}</p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Site</p>
            <p className="font-semibold">{session.siteDomain}</p>
            <p className="text-xs text-muted-foreground break-all">{session.pagePath}</p>
            <p className="text-xs text-muted-foreground">{session.pageTitle}</p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Academic Context</p>
            <p className="font-semibold">{session.subject}</p>
            <p className="text-xs text-muted-foreground">{session.category ?? 'No category recorded'}</p>
            <p className="text-xs text-muted-foreground">{`${session.detectionMode} detection`}</p>
          </Card>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Card className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Started</p>
            <p className="font-semibold">{session.startedAt}</p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ended</p>
            <p className="font-semibold">{session.endedAt ?? 'Still open'}</p>
          </Card>
        </div>

        <Card className="mt-6 space-y-3 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Why This Session Matters</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>This is one billed extension usage window.</p>
            <p>It combines time spent, pages visited, subject detection, and analyze attempts under one audit record.</p>
            <p>{`${session.noMatchCount} no-match event${session.noMatchCount === 1 ? '' : 's'} were logged in this session.`}</p>
          </div>
        </Card>

        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>
  );
}
