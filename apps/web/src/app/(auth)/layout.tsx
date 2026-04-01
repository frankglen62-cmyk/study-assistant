import Link from 'next/link';
import type { ReactNode } from 'react';
import { Sparkles, ShieldCheck, BookOpenText, GraduationCap } from 'lucide-react';

import { LogoMark } from '@/components/layout/logo-mark';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50/50 via-background to-emerald-50/30">
      <div className="relative mx-auto flex h-[100dvh] max-w-6xl flex-col px-6 py-6">
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between">
          <LogoMark />
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to site
          </Link>
        </div>

        {/* Main split layout */}
        <div className="flex flex-1 items-center justify-center pb-12">
          <div className="grid w-full gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            {/* Left Hero */}
            <div className="relative hidden lg:block">
              <div className="space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  Secure Access
                </span>

                <h1 className="font-display text-4xl text-foreground xl:text-5xl tracking-tight">
                  Welcome back!
                  <br />
                  <span className="text-accent">
                    Sign in to your account
                  </span>
                </h1>

                <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
                  Access your AI-powered study assistant. Subject-aware answers grounded in admin-curated course material.
                </p>
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
