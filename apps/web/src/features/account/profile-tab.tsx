import { Mail, User, Clock, ShieldCheck } from 'lucide-react';

import { Badge } from '@study-assistant/ui';

export function ProfileTab({
  fullName,
  role,
  email,
  accountStatus,
}: {
  fullName: string;
  role: string;
  email: string;
  accountStatus: string;
}) {
  const initials = fullName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center border-4 border-black bg-accent text-2xl font-black text-black">
            {initials}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h2 className="font-display text-2xl font-black uppercase text-black">{fullName}</h2>
              <Badge tone="accent" className="capitalize border-black">
                {role.replace('_', ' ')}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Mail className="h-4 w-4 text-black/60" />
                <span className="text-xs font-bold uppercase tracking-widest text-black/70">{email}</span>
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-success border-2 border-success px-1.5 py-0.5">
                  <span className="h-2 w-2 bg-success" />
                  Verified
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <ShieldCheck className="h-4 w-4 text-black/60" />
                <span className="text-xs font-bold uppercase tracking-widest text-black/70 capitalize">
                  {accountStatus.replace('_', ' ')}
                </span>
                <span className="h-2 w-2 bg-success border border-success" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-4 border-black bg-surface p-6 shadow-solid-sm">
        <h3 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-black flex items-center gap-2">
          <User className="h-4 w-4" />
          Account Details
        </h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Display Name</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-black">{fullName}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Role</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-black capitalize">{role.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Email Address</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-black">{email}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60">Account Status</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-black capitalize flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {accountStatus.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
