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
      <div className="rounded-2xl border border-border/50 bg-background/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-medium text-foreground">Extension Access</h3>
          <Badge tone={pairedCount > 0 ? 'success' : 'warning'} className="text-xs ml-auto">
            {pairedCount > 0 ? `${pairedCount} paired` : 'Not paired'}
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Paired Browsers</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{pairedCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Version</p>
            <p className="mt-1 text-lg font-semibold text-accent">v{extensionVersion}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Latest Browser</p>
            <p className="mt-1 text-sm font-medium text-foreground truncate">
              {latestDevice?.name ?? 'No browser yet'}
            </p>
            {latestDevice ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                v{latestDevice.version} · {latestDevice.lastSeen}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-background/30 p-5">
        <h3 className="mb-3 text-sm font-medium text-foreground flex items-center gap-2">
          <Monitor className="h-4 w-4 text-accent" />
          Quick Actions
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
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
