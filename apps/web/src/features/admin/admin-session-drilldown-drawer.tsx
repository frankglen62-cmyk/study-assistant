'use client';

import { X } from 'lucide-react';

import { Button } from '@study-assistant/ui';

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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border/40 bg-background p-6 shadow-soft-xl sm:p-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-accent">Quick Session View</p>
            <h3 className="font-display text-3xl text-foreground">{session.userName}</h3>
            <p className="text-sm text-muted-foreground">{session.userEmail}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        {/* Info Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <StatusBadge status={session.status} />
            <p className="border-t border-border/40 pt-2 text-xs text-muted-foreground">{session.suspiciousFlag}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Billing</p>
            <p className="font-display text-2xl text-foreground">{session.creditsUsed}</p>
            <p className="border-t border-border/40 pt-2 text-xs text-muted-foreground">{`${session.analyzeCount} analyze attempt${session.analyzeCount === 1 ? '' : 's'}`}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Site</p>
            <p className="font-semibold text-foreground break-words">{session.siteDomain}</p>
            <p className="border-t border-border/40 pt-2 text-xs text-muted-foreground break-all">{session.pagePath}</p>
            <p className="text-xs text-muted-foreground">{session.pageTitle}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Academic Context</p>
            <p className="font-semibold text-foreground">{session.subject}</p>
            <p className="border-t border-border/40 pt-2 text-xs text-muted-foreground">{session.category ?? 'No category recorded'}</p>
            <p className="text-xs text-muted-foreground">{`${session.detectionMode} detection`}</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-accent/5 p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Started</p>
            <p className="font-medium text-foreground">{session.startedAt}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-accent/5 p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Ended</p>
            <p className="font-medium text-foreground">{session.endedAt ?? 'Still open'}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 rounded-xl border border-amber-200/60 bg-amber-50/50 p-5 space-y-3">
          <p className="text-xs font-semibold text-amber-800">Why This Session Matters</p>
          <div className="space-y-2 text-sm text-amber-700">
            <p>This is one billed extension usage window.</p>
            <p>It combines time spent, pages visited, subject detection, and analyze attempts under one audit record.</p>
            <p className="font-semibold text-amber-800">{`${session.noMatchCount} no-match event${session.noMatchCount === 1 ? '' : 's'} were logged in this session.`}</p>
          </div>
        </div>

        {footer ? <div className="mt-6 border-t border-border/40 pt-6">{footer}</div> : null}
      </div>
    </div>
  );
}
