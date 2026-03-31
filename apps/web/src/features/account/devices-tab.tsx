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
      <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Monitor className="h-4 w-4 text-accent" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Device Summary</h3>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Devices</p>
            <p className="mt-1 font-display text-3xl text-foreground">{devices.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Active</p>
            <p className="mt-1 font-display text-3xl text-accent">{activeCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Current Device</p>
            <p className="mt-1 text-sm font-medium text-foreground truncate">
              {currentDevice?.name ?? 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex gap-1 rounded-xl bg-surface/50 p-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              filter === f.id
                ? 'bg-white text-foreground shadow-soft-sm'
                : 'text-muted-foreground hover:bg-white/50 hover:text-foreground'
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
      <div className="space-y-3">
        {filteredDevices.length > 0 ? (
          filteredDevices.map((device, index) => (
            <div
              key={device.id}
              className={`flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between transition-all ${
                index === 0 && filter === 'all'
                  ? 'border-accent/30 bg-accent/5 ring-1 ring-accent/10'
                  : device.status === 'revoked'
                    ? 'border-border/30 bg-surface/30 opacity-60'
                    : 'border-border/40 bg-white shadow-card'
              }`}
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Monitor className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{device.name}</p>
                    {index === 0 && filter === 'all' ? (
                      <Badge tone="accent" className="text-xs">Current</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-mono text-foreground">
                      {device.version}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {device.lastSeen}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-center">
                <StatusBadge status={device.status} />
                {device.status === 'active' ? (
                  <RevokeDeviceButton installationId={device.id} />
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/40 bg-surface/30 p-10 text-center flex flex-col items-center gap-4">
            <AlertTriangle className="h-10 w-10 text-amber-400" />
            <div>
              <p className="text-lg font-semibold text-foreground">No devices found</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
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
