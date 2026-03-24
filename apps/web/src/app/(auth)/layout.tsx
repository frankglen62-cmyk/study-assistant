import Link from 'next/link';
import type { ReactNode } from 'react';
import { GraduationCap, Sparkles, ShieldCheck, BookOpenText } from 'lucide-react';

import { LogoMark } from '@/components/layout/logo-mark';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-teal-500/[0.06] via-cyan-500/[0.03] to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-gradient-to-t from-teal-500/[0.04] to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <LogoMark />
          <Link
            href="/"
            className="text-sm text-neutral-400 transition-colors hover:text-white"
          >
            Back to site
          </Link>
        </div>

        {/* Main split layout */}
        <div className="flex flex-1 items-center py-12">
          <div className="grid w-full gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
            {/* Left Hero */}
            <div className="relative hidden lg:block">
              {/* Floating icons */}
              <div className="absolute -left-4 top-8 animate-float rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 backdrop-blur-sm">
                <GraduationCap className="h-6 w-6 text-neutral-500" />
              </div>
              <div className="absolute -right-2 top-4 animate-float-delayed rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 backdrop-blur-sm">
                <Sparkles className="h-6 w-6 text-neutral-500" />
              </div>

              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
                  <ShieldCheck className="h-4 w-4 text-teal-400" />
                  Secure Access
                </div>

                <h1 className="text-4xl font-bold tracking-tight text-white xl:text-5xl">
                  Welcome back!
                  <br />
                  <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
                    Sign in to your account
                  </span>
                </h1>

                <p className="max-w-md text-lg leading-relaxed text-neutral-400">
                  Access your AI-powered study assistant. Subject-aware answers grounded in admin-curated course material.
                </p>

                {/* Dashboard preview card */}
                <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-2xl">
                  <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                        <BookOpenText className="h-4 w-4 text-teal-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">Study Session Active</div>
                        <div className="text-xs text-neutral-600">Physics • Confidence: 94%</div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3 text-sm text-neutral-400">
                      Suggested: The SI unit of electric charge is the Coulomb (C), named after Charles-Augustin de Coulomb.
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs text-teal-400">Copy Answer</span>
                      <span className="rounded-full bg-white/[0.04] px-3 py-1 text-xs text-neutral-500">View Explanation</span>
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
