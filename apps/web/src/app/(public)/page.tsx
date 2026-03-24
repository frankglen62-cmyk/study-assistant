import Link from 'next/link';
import {
  ArrowRight,
  BrainCircuit,
  BookOpenText,
  FolderTree,
  GraduationCap,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Star,
  WalletCards,
  Zap,
} from 'lucide-react';

import { featureCards, howItWorks, testimonials, faqItems } from '@/features/public/content';

const iconMap: Record<string, any> = {
  BrainCircuit,
  FolderTree,
  WalletCards,
  MonitorSmartphone,
  Sparkles,
  ShieldCheck,
};

export default function HomePage() {
  return (
    <div className="overflow-hidden bg-[#0a0a0a]">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-gradient-to-b from-teal-500/[0.08] via-cyan-500/[0.05] to-transparent blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        </div>

        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-[8%] top-[20%] animate-float rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm">
            <GraduationCap className="h-7 w-7 text-neutral-500" />
          </div>
          <div className="absolute right-[10%] top-[15%] animate-float-delayed rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm">
            <Sparkles className="h-7 w-7 text-neutral-500" />
          </div>
          <div className="absolute left-[12%] top-[55%] animate-float-slow rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm">
            <BookOpenText className="h-7 w-7 text-neutral-500" />
          </div>
          <div className="absolute right-[8%] top-[50%] animate-float rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm">
            <ShieldCheck className="h-7 w-7 text-neutral-500" />
          </div>
          <div className="absolute left-[5%] top-[75%] animate-float-delayed rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm">
            <WalletCards className="h-7 w-7 text-neutral-500" />
          </div>
          <div className="absolute right-[15%] top-[75%] animate-float-slow rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm">
            <BrainCircuit className="h-7 w-7 text-neutral-500" />
          </div>
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 text-center lg:pt-32">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400 backdrop-blur-sm transition-colors hover:border-white/20">
            <Zap className="h-4 w-4 text-teal-400" />
            <span>Discover the AI-powered Study Assistant</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>

          <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            One Workspace For
            {' '}
            <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
              Faster Subject Review
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-neutral-400">
            Study Assistant keeps your portal, extension, and subject-based review flow in one clean experience
            so learners can stay focused without exposing the internal structure behind the system.
          </p>

          <div className="mx-auto mt-10 max-w-5xl rounded-[30px] border border-white/[0.08] bg-white/[0.03] px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-400/90">
              Access content from leading platforms — all in one place
            </p>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-neutral-500 sm:text-base">
              Built for study workflows familiar to learners across Coursera, Course Hero, Scribd, Studocu, and Chegg,
              while keeping everything organized inside one controlled review experience.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-12">
              <span className="text-lg font-bold tracking-[0.18em] text-neutral-500 sm:text-xl">coursera</span>
              <span className="text-lg font-bold tracking-[0.12em] text-neutral-500 sm:text-xl">Course Hero</span>
              <span className="text-lg font-bold tracking-[0.16em] text-neutral-500 sm:text-xl">scribd</span>
              <span className="text-lg font-bold tracking-[0.14em] text-neutral-500 sm:text-xl">studocu</span>
              <span className="text-lg font-bold tracking-[0.16em] text-neutral-500 sm:text-xl">chegg</span>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:bg-neutral-200"
            >
              Get Started
            </Link>
            <Link
              href="/#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              How it Works
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#0a0a0a] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
              <Sparkles className="h-4 w-4 text-teal-400" />
              Features
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              A Cleaner Study Workspace
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-500">
              Designed to keep the portal and extension easier to understand, easier to navigate, and easier to trust.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => {
              const Icon = iconMap[feature.icon] ?? Sparkles;
              return (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-white/10 hover:bg-white/[0.04]"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 transition-colors group-hover:bg-teal-500/20">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-neutral-500">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-white/[0.06] bg-[#0a0a0a] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">How It Works</h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-500">
              A simple flow from setup to a cleaner, subject-based review session.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-400">
                  {item.step}
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-[#0f0f0f] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
              <Star className="h-4 w-4 text-teal-400" />
              Testimonials
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              See What Our Users Are Saying
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-500">
              Here&apos;s what students and administrators say about our platform.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-white/10"
              >
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-teal-400 text-teal-400" />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-neutral-400">{t.rating}</span>
                </div>

                <p className="mb-6 text-sm leading-relaxed text-neutral-300">&quot;{t.quote}&quot;</p>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-bold text-white">
                    {t.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{t.name}</div>
                    <div className="text-xs text-neutral-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-white/[0.06] bg-[#0a0a0a] py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-500">
              Everything you need to know about the platform.
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item) => (
              <div
                key={item.question}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
              >
                <h3 className="mb-2 text-base font-semibold text-white">{item.question}</h3>
                <p className="text-sm leading-relaxed text-neutral-500">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0a0a0a] py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-teal-500/[0.06] to-cyan-500/[0.04] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Ready to Study Smarter?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-neutral-500">
            Join learners using a cleaner, subject-focused review workspace built for consistent study support.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:bg-neutral-200"
            >
              Get Started
            </Link>
            <Link
              href="/#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              How it Works
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
