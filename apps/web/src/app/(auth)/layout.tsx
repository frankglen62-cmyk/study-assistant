import Link from 'next/link';
import type { ReactNode } from 'react';
import { Sparkles, ShieldCheck, BookOpenText, GraduationCap } from 'lucide-react';

import { LogoMark } from '@/components/layout/logo-mark';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50/50 via-background to-emerald-50/30">
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <LogoMark />
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to site
          </Link>
        </div>

        {/* Main split layout */}
        <div className="flex flex-1 items-center py-12">
          <div className="grid w-full gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
            {/* Left Hero */}
            <div className="relative hidden lg:block">
              <div className="space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  Secure Access
                </span>

                <h1 className="font-display text-4xl text-foreground xl:text-5xl">
                  Welcome back!
                  <br />
                  <span className="text-accent">
                    Sign in to your account
                  </span>
                </h1>

                <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
                  Access your AI-powered study assistant. Subject-aware answers grounded in admin-curated course material.
                </p>

                {/* Preview card */}
                <div className="mt-8 overflow-hidden rounded-2xl border border-border/40 bg-white shadow-card">
                  <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-300" />
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center">
                        <BookOpenText className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">Study Session Active</div>
                        <div className="text-xs text-muted-foreground">Physics • Confidence: 94%</div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">
                      Suggested: The SI unit of electric charge is the Coulomb (C), named after Charles-Augustin de Coulomb.
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">Copy Answer</span>
                      <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">View Explanation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Form */}
            <div className="mx-auto w-full max-w-[440px]">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
