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
      <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
        <div className="flex items-center gap-3 mb-6">
          <Package className="h-5 w-5 text-black" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-black">Extension Access</h3>
          <Badge tone={pairedCount > 0 ? 'success' : 'warning'} className="ml-auto border-black">
            {pairedCount > 0 ? `${pairedCount} paired` : 'Not paired'}
          </Badge>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Paired Browsers</p>
            <p className="mt-1 font-display text-3xl font-black text-black">{pairedCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Current Version</p>
            <p className="mt-1 font-display text-3xl font-black text-accent">v{extensionVersion}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Latest Browser</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-black truncate">
              {latestDevice?.name ?? 'No browser yet'}
            </p>
            {latestDevice ? (
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-black/60">
                v{latestDevice.version} · {latestDevice.lastSeen}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
        <h3 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-black flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          Quick Actions
        </h3>
        <p className="text-[10px] font-bold uppercase tracking-widest text-black/60 mb-6">
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
