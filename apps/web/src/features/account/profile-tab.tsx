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
      <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-card">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-xl font-semibold text-accent">
            {initials}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h2 className="text-xl font-semibold text-foreground">{fullName}</h2>
              <Badge tone="accent" className="capitalize">
                {role.replace('_', ' ')}
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{email}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Verified
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground capitalize">
                  {accountStatus.replace('_', ' ')}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-card">
        <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Account Details
        </h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Display Name</p>
            <p className="mt-1 text-sm font-medium text-foreground">{fullName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Role</p>
            <p className="mt-1 text-sm font-medium text-foreground capitalize">{role.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Email Address</p>
            <p className="mt-1 text-sm font-medium text-foreground">{email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Account Status</p>
            <p className="mt-1 text-sm font-medium text-foreground capitalize flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {accountStatus.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
