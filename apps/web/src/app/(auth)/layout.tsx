import Link from 'next/link';
import type { ReactNode } from 'react';

import { LogoMark } from '@/components/layout/logo-mark';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[image:radial-gradient(circle_at_top_left,rgba(21,168,154,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.15),transparent_26%)]">
      <div className="page-shell relative flex min-h-screen flex-col justify-center py-10">
        <div className="mb-10 flex items-center justify-between">
          <LogoMark />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to site
          </Link>
        </div>
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="space-y-5">
            <p className="text-sm uppercase tracking-[0.18em] text-accent">Secure access</p>
            <h1 className="font-display text-5xl font-semibold tracking-tight">
              Client and admin workspaces share one secure platform, not one permission model.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              The web app keeps client billing, paired extensions, and usage logs separate from admin-only source management, analytics, and controls.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-border/70 bg-surface/75 p-4 text-sm text-muted-foreground">
                Supabase Auth for email/password login and reset flows
              </div>
              <div className="rounded-[24px] border border-border/70 bg-surface/75 p-4 text-sm text-muted-foreground">
                Row Level Security for user-facing records and private admin content separation
              </div>
            </div>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
