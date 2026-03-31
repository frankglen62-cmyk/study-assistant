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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border/40 bg-background p-6 shadow-soft-lg sm:p-12">
        <div className="flex items-start justify-between gap-4 border-b-4 border-black pb-8">
          <div className="space-y-1">
            <p className="text-xs font-medium text-accent">Quick Session View</p>
            <h3 className="font-display text-4xl font-semibold tracking-tighter text-black">{session.userName}</h3>
            <p className="text-sm font-medium text-black/60">{session.userEmail}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose} className="border border-border/40 uppercase font-black tracking-widest hover:bg-black hover:text-white rounded-none">
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Card className="space-y-2 p-6 rounded-xl border border-border/40 shadow-card bg-surface">
            <p className="text-xs font-medium text-foreground">Status</p>
            <StatusBadge status={session.status} />
            <p className="border-t-2 border-black/10 pt-2 text-xs text-muted-foreground text-black/60">{session.suspiciousFlag}</p>
          </Card>
          <Card className="space-y-2 p-6 rounded-xl border border-border/40 shadow-card bg-surface">
            <p className="text-xs font-medium text-foreground">Billing</p>
            <p className="font-display text-3xl font-black">{session.creditsUsed}</p>
            <p className="border-t-2 border-black/10 pt-2 text-xs text-muted-foreground text-black/60">{`${session.analyzeCount} analyze attempt${session.analyzeCount === 1 ? '' : 's'}`}</p>
          </Card>
          <Card className="space-y-2 p-6 rounded-xl border border-border/40 shadow-card bg-surface">
            <p className="text-xs font-medium text-foreground">Site</p>
            <p className="font-black text-lg break-words">{session.siteDomain}</p>
            <p className="border-t-2 border-black/10 pt-2 text-xs text-muted-foreground text-black/60 break-all">{session.pagePath}</p>
            <p className="text-xs text-muted-foreground text-black/60">{session.pageTitle}</p>
          </Card>
          <Card className="space-y-2 p-6 rounded-xl border border-border/40 shadow-card bg-surface">
            <p className="text-xs font-medium text-foreground">Academic Context</p>
            <p className="font-black text-lg">{session.subject}</p>
            <p className="border-t-2 border-black/10 pt-2 text-xs text-muted-foreground text-black/60">{session.category ?? 'No category recorded'}</p>
            <p className="text-xs text-muted-foreground text-black/60">{`${session.detectionMode} detection`}</p>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card className="space-y-2 p-6 rounded-xl border border-border/40 shadow-card bg-accent/10">
            <p className="text-xs font-medium text-foreground">Started</p>
            <p className="font-black">{session.startedAt}</p>
          </Card>
          <Card className="space-y-2 p-6 rounded-xl border border-border/40 shadow-card bg-accent/10">
            <p className="text-xs font-medium text-foreground">Ended</p>
            <p className="font-black">{session.endedAt ?? 'Still open'}</p>
          </Card>
        </div>

        <Card className="mt-8 space-y-4 p-8 rounded-xl border border-border/40 shadow-card bg-warning/20">
          <p className="text-xs font-medium text-foreground">Why This Session Matters</p>
          <div className="space-y-3 font-bold uppercase tracking-wide text-black/80 text-xs">
            <p>This is one billed extension usage window.</p>
            <p>It combines time spent, pages visited, subject detection, and analyze attempts under one audit record.</p>
            <p className="font-black text-black">{`${session.noMatchCount} no-match event${session.noMatchCount === 1 ? '' : 's'} were logged in this session.`}</p>
          </div>
        </Card>

        {footer ? <div className="mt-8 border-t-4 border-black pt-8">{footer}</div> : null}
      </div>
    </div>
  );
}
