'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Monitor, Clock, AlertTriangle } from 'lucide-react';

import { Badge, Button } from '@study-assistant/ui';

import { StatusBadge } from '@/components/status-badge';
import { RevokeDeviceButton } from '@/features/client/revoke-device-button';

type Device = {
  id: string;
  name: string;
  version: string;
  lastSeen: string;
  status: string;
};

type FilterType = 'all' | 'active' | 'revoked';

export function DevicesTab({ devices }: { devices: Device[] }) {
  const [filter, setFilter] = useState<FilterType>('all');

  const activeCount = devices.filter((d) => d.status === 'active').length;
  const revokedCount = devices.filter((d) => d.status === 'revoked').length;
  const currentDevice = devices[0] ?? null;

  const filteredDevices = devices.filter((device) => {
    if (filter === 'active') return device.status === 'active';
    if (filter === 'revoked') return device.status === 'revoked';
    return true;
  });

  const filters: { id: FilterType; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: devices.length },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'revoked', label: 'Revoked', count: revokedCount },
  ];

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-2xl border border-border/50 bg-background/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-medium text-foreground">Device Summary</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Total Devices</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{devices.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">{activeCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Device</p>
            <p className="mt-1 text-sm font-medium text-foreground truncate">
              {currentDevice?.name ?? 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex gap-1 rounded-xl border border-border/50 bg-background/30 p-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              filter === f.id
                ? 'bg-accent/15 text-accent'
                : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
            }`}
          >
            {f.label}
            {f.count !== undefined ? (
              <span className="text-xs opacity-60">{f.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Device list */}
      <div className="space-y-2">
        {filteredDevices.length > 0 ? (
          filteredDevices.map((device, index) => (
            <div
              key={device.id}
              className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                index === 0 && filter === 'all'
                  ? 'border-accent/20 bg-accent/[0.04]'
                  : device.status === 'revoked'
                    ? 'border-border/30 bg-background/20 opacity-60'
                    : 'border-border/50 bg-background/30'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{device.name}</p>
                    {index === 0 && filter === 'all' ? (
                      <Badge tone="accent" className="text-[10px]">Current</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground bg-white/[0.04] px-1.5 py-0.5 rounded">
                      {device.version}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {device.lastSeen}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <StatusBadge status={device.status} />
                {device.status === 'active' ? (
                  <RevokeDeviceButton installationId={device.id} />
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/50 bg-background/30 px-6 py-10 text-center flex flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <div>
              <p className="text-sm font-medium text-foreground">No devices found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {filter !== 'all'
                  ? 'No devices match this filter. Try selecting "All".'
                  : 'Open the Extension Guide to download and pair your first browser.'}
              </p>
            </div>
            {filter === 'all' ? (
              <Button asChild size="sm">
                <Link href="/extension-guide">Go To Extension Guide</Link>
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
