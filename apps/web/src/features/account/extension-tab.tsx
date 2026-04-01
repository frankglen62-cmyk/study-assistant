import Link from 'next/link';
import { Download, ArrowRight, Monitor, Package } from 'lucide-react';

import { Badge, Button } from '@study-assistant/ui';

import { extensionDownloadFileName, extensionDownloadPath, extensionVersion } from '@/lib/extension-distribution';

export function ExtensionTab({
  pairedCount,
  latestDevice,
}: {
  pairedCount: number;
  latestDevice: { name: string; version: string; lastSeen: string } | null;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/40 bg-background p-6 shadow-card">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Package className="h-4 w-4 text-accent" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Extension Access</h3>
          <Badge tone={pairedCount > 0 ? 'success' : 'warning'} className="ml-auto">
            {pairedCount > 0 ? `${pairedCount} paired` : 'Not paired'}
          </Badge>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Paired Browsers</p>
            <p className="mt-1 font-display text-3xl text-foreground">{pairedCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Current Version</p>
            <p className="mt-1 font-display text-3xl text-accent">v{extensionVersion}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Latest Browser</p>
            <p className="mt-1 text-sm font-medium text-foreground truncate">
              {latestDevice?.name ?? 'No browser yet'}
            </p>
            {latestDevice ? (
              <p className="mt-1 text-xs text-muted-foreground">
                v{latestDevice.version} · {latestDevice.lastSeen}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-background p-6 shadow-card">
        <h3 className="mb-2 text-sm font-semibold text-foreground flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          Quick Actions
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          Use the guide when you need to install, update, or pair another browser.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm">
            <Link href="/extension-guide">
              Open Extension Guide
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={extensionDownloadPath} download={extensionDownloadFileName}>
              <Download className="h-3.5 w-3.5" />
              Download ZIP v{extensionVersion}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
