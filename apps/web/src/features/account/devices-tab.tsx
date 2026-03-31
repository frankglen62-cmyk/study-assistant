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
      <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="h-5 w-5 text-black" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-black">Device Summary</h3>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Total Devices</p>
            <p className="mt-1 font-display text-3xl font-black text-black">{devices.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Active</p>
            <p className="mt-1 font-display text-3xl font-black text-success">{activeCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Current Device</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-black truncate">
              {currentDevice?.name ?? 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex gap-0 border-4 border-black bg-surface">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-100 border-r-2 border-black/20 last:border-r-0 ${
              filter === f.id
                ? 'bg-accent text-black'
                : 'text-black/40 hover:bg-black/5 hover:text-black'
            }`}
          >
            {f.label}
            {f.count !== undefined ? (
              <span className="text-[10px] opacity-60">{f.count}</span>
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
              className={`flex flex-col gap-3 border-4 p-5 sm:flex-row sm:items-center sm:justify-between ${
                index === 0 && filter === 'all'
                  ? 'border-accent bg-accent/5 shadow-solid-sm'
                  : device.status === 'revoked'
                    ? 'border-black/30 bg-surface/50 opacity-60'
                    : 'border-black bg-surface shadow-solid-sm'
              }`}
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center border-4 border-black bg-accent">
                  <Monitor className="h-5 w-5 text-black" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black uppercase text-black truncate">{device.name}</p>
                    {index === 0 && filter === 'all' ? (
                      <Badge tone="accent" className="text-[10px] border-black">Current</Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-mono font-black uppercase tracking-widest text-black border-2 border-black/10 bg-black/5 px-2 py-0.5">
                      {device.version}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-black/60">
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
          <div className="border-4 border-dashed border-black/30 bg-surface p-10 text-center flex flex-col items-center gap-4">
            <AlertTriangle className="h-10 w-10 text-warning" />
            <div>
              <p className="font-display text-xl font-black uppercase text-black">No devices found</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/60 mt-2 max-w-sm">
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
