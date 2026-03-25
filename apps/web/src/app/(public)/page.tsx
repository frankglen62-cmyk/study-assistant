'use client';

import type { ComponentType } from 'react';
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
import { motion, useReducedMotion } from 'framer-motion';

import { InteractiveCard } from '@/components/interactive-card';
import { FaqAccordion } from '@/components/faq-accordion';
import { featureCards, faqItems, howItWorks, testimonials } from '@/features/public/content';
import {
  buttonHover,
  buttonTap,
  heroBadgeReveal,
  heroContainer,
  heroCtaReveal,
  heroHeadlineReveal,
  heroTextReveal,
  sectionReveal,
  staggerContainer,
  staggerItem,
  trustStripReveal,
} from '@/lib/motion';

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  BrainCircuit,
  FolderTree,
  WalletCards,
  MonitorSmartphone,
  Sparkles,
  ShieldCheck,
};

function SectionGlow({
  className,
  gradient,
}: {
  className: string;
  gradient: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full blur-3xl animate-aurora ${className}`}
      style={{ background: gradient }}
    />
  );
}

function PlatformTicker() {
  const platforms = [
    { name: 'coursera', className: 'font-black tracking-[-0.05em] text-white/42' },
    { name: 'Course Hero', className: 'font-semibold tracking-[-0.04em] text-[#5d73ff]/58' },
    { name: 'scribd', className: 'font-light uppercase tracking-[0.24em] text-[#53d0d7]/55' },
    { name: 'studocu', className: 'font-black tracking-[-0.05em] text-white/46' },
    { name: 'chegg', className: 'font-extrabold tracking-[-0.06em] text-[#ff8a2a]/58' },
  ];
  const row = [...platforms, ...platforms];

  return (
    <div className="relative mx-auto mt-14 w-full max-w-6xl overflow-hidden rounded-[40px] border border-white/[0.05] bg-white/[0.015] px-3 py-6 before:absolute before:left-0 before:top-0 before:z-10 before:h-full before:w-24 before:bg-gradient-to-r before:from-[#0a0a0a] before:to-transparent after:absolute after:right-0 after:top-0 after:z-10 after:h-full after:w-24 after:bg-gradient-to-l after:from-[#0a0a0a] after:to-transparent">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.08),transparent_42%)]" />
      <div className="relative space-y-4">
        <div className="flex w-max animate-marquee-left items-center gap-12">
          {row.map((platform, index) => (
            <span
              key={`${platform.name}-${index}`}
              className={`text-[30px] transition-opacity duration-500 ${platform.className}`}
            >
              {platform.name}
            </span>
          ))}
        </div>
        <div className="flex w-max animate-marquee-right items-center gap-12" aria-hidden="true">
          {[...row].reverse().map((platform, index) => (
            <span
              key={`reverse-${platform.name}-${index}`}
              className={`text-[24px] opacity-60 transition-opacity duration-500 ${platform.className}`}
            >
              {platform.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const reduced = useReducedMotion();

  return (
    <div className="overflow-hidden bg-[#0a0a0a]">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0">
          <SectionGlow
            className="left-[10%] top-[8%] h-[420px] w-[420px] opacity-70 [animation-duration:18s]"
            gradient="radial-gradient(circle, rgba(45,212,191,0.18), transparent 70%)"
          />
          <SectionGlow
            className="right-[8%] top-[12%] h-[520px] w-[520px] opacity-60 [animation-duration:24s]"
            gradient="radial-gradient(circle, rgba(34,211,238,0.12), transparent 72%)"
          />
          <SectionGlow
            className="left-1/2 top-[38%] h-[620px] w-[760px] -translate-x-1/2 opacity-55 [animation-duration:21s]"
            gradient="radial-gradient(circle, rgba(20,184,166,0.12), transparent 74%)"
          />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        </div>

        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <motion.div
            className="absolute left-[8%] top-[22%] rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm"
            animate={reduced ? undefined : { y: [0, -6, 0], rotate: [0, 2, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <GraduationCap className="h-6 w-6 text-neutral-600" />
          </motion.div>
          <motion.div
            className="absolute right-[10%] top-[16%] rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm"
            animate={reduced ? undefined : { y: [0, -8, 0], rotate: [0, -3, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          >
            <Sparkles className="h-6 w-6 text-neutral-600" />
          </motion.div>
          <motion.div
            className="absolute left-[5%] top-[60%] rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm"
            animate={reduced ? undefined : { y: [0, -5, 0], rotate: [0, -2, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          >
            <BookOpenText className="h-6 w-6 text-neutral-600" />
          </motion.div>
          <motion.div
            className="absolute right-[7%] top-[55%] rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm"
            animate={reduced ? undefined : { y: [0, -6, 0], rotate: [0, 2, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          >
            <ShieldCheck className="h-6 w-6 text-neutral-600" />
          </motion.div>
        </div>

        <motion.div
          className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 text-center lg:pt-32"
          variants={heroContainer}
          initial={reduced ? undefined : 'hidden'}
          animate={reduced ? undefined : 'visible'}
        >
          <motion.div
            variants={heroBadgeReveal}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400 backdrop-blur-sm"
          >
            <Zap className="h-4 w-4 text-teal-400" />
            <span>Discover the AI-powered Study Assistant</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </motion.div>

          <motion.h1
            variants={heroHeadlineReveal}
            className="mx-auto max-w-5xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            One Workspace For{' '}
            <span className="bg-[linear-gradient(120deg,#5eead4,#2dd4bf,#67e8f9,#5eead4)] bg-[length:220%_220%] bg-clip-text text-transparent animate-shimmer">
              Faster Subject Review
            </span>
          </motion.h1>

          <motion.p
            variants={heroTextReveal}
            className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-neutral-400"
          >
            Study Assistant keeps your portal, extension, and subject-based review flow in one
            clean experience so learners can stay focused without exposing the internal structure
            behind the system.
          </motion.p>

          <motion.div
            variants={heroCtaReveal}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div whileHover={reduced ? undefined : buttonHover} whileTap={reduced ? undefined : buttonTap}>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-black/20 transition-colors hover:bg-neutral-100"
              >
                Get Started
              </Link>
            </motion.div>
            <motion.div whileHover={reduced ? undefined : buttonHover} whileTap={reduced ? undefined : buttonTap}>
              <Link
                href="/#how-it-works"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                How it Works
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            variants={trustStripReveal}
            className="mx-auto mt-16 max-w-5xl"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-400/90">
              Access content from leading platforms - all in one place
            </p>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-neutral-500 sm:text-base">
              Built for admin-curated review libraries that can organize approved course references
              alongside materials learners commonly recognize from established study ecosystems,
              while keeping everything inside one controlled experience.
            </p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }}>
              <PlatformTicker />
            </motion.div>
            <p className="mx-auto mt-5 max-w-3xl text-xs leading-6 text-neutral-600">
              Third-party names remain the property of their respective owners. Their mention here
              describes familiar study formats only and does not imply endorsement or affiliation.
            </p>
          </motion.div>
        </motion.div>
      </section>

      <section className="bg-[#0a0a0a] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.2 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
              <Sparkles className="h-4 w-4 text-teal-400" />
              Features
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              A Cleaner Study Workspace
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-500">
              Designed to keep the portal and extension easier to understand, easier to navigate,
              and easier to trust.
            </p>
          </motion.div>

          <motion.div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            variants={staggerContainer}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.15 }}
          >
            {featureCards.map((feature) => {
              const Icon = iconMap[feature.icon] ?? Sparkles;
              return (
                <motion.div key={feature.title} variants={staggerItem}>
                  <InteractiveCard className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 transition-colors group-hover:bg-teal-500/20">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-neutral-500">{feature.description}</p>
                  </InteractiveCard>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="relative border-t border-white/[0.06] bg-[#0a0a0a] py-24">
        <div className="pointer-events-none absolute inset-0">
          <SectionGlow
            className="left-[14%] top-[10%] h-[360px] w-[360px] opacity-45 [animation-duration:25s]"
            gradient="radial-gradient(circle, rgba(103,232,249,0.10), transparent 72%)"
          />
        </div>
        <div className="relative mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.2 }}
          >
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              How It Works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-500">
              A smooth flow from setup to a cleaner, subject-based review session.
            </p>
          </motion.div>

          <motion.div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            variants={staggerContainer}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.15 }}
          >
            {howItWorks.map((item) => (
              <motion.div key={item.step} variants={staggerItem}>
                <InteractiveCard
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
                  accent="rgba(45, 212, 191, 0.12)"
                  borderAccent="rgba(255,255,255,0.14)"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-400">
                    {item.step}
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-neutral-500">{item.description}</p>
                </InteractiveCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-[#0f0f0f] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.2 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
              <Star className="h-4 w-4 text-teal-400" />
              Testimonials
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              See What Our Users Are Saying
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-500">
              Here&apos;s what students and administrators say about the platform.
            </p>
          </motion.div>

          <motion.div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            variants={staggerContainer}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.1 }}
          >
            {testimonials.map((item) => (
              <motion.div key={item.name} variants={staggerItem}>
                <InteractiveCard className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-teal-400 text-teal-400" />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-neutral-400">{item.rating}</span>
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-neutral-300">&quot;{item.quote}&quot;</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-bold text-white">
                      {item.name
                        .split(' ')
                        .map((chunk) => chunk[0])
                        .join('')}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{item.name}</div>
                      <div className="text-xs text-neutral-500">{item.role}</div>
                    </div>
                  </div>
                </InteractiveCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="faq" className="border-t border-white/[0.06] bg-[#0a0a0a] py-24">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div
            className="mb-16 text-center"
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.25 }}
          >
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-500">
              Everything you need to know about the platform.
            </p>
          </motion.div>

          <motion.div
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.15 }}
          >
            <FaqAccordion items={faqItems} />
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0a0a0a] py-24">
        <div className="pointer-events-none absolute inset-0">
          <SectionGlow
            className="left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 opacity-70 [animation-duration:20s]"
            gradient="radial-gradient(circle, rgba(45,212,191,0.14), transparent 72%)"
          />
        </div>

        <motion.div
          className="relative mx-auto max-w-3xl px-6 text-center"
          variants={heroContainer}
          initial={reduced ? undefined : 'hidden'}
          whileInView={reduced ? undefined : 'visible'}
          viewport={{ once: true, amount: 0.25 }}
        >
          <motion.h2
            variants={heroHeadlineReveal}
            className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
          >
            Ready to Study Smarter?
          </motion.h2>
          <motion.p variants={heroTextReveal} className="mx-auto mt-4 max-w-xl text-neutral-500">
            Join learners using a cleaner, subject-focused review workspace built for consistent
            study support.
          </motion.p>
          <motion.div
            variants={heroCtaReveal}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div whileHover={reduced ? undefined : buttonHover} whileTap={reduced ? undefined : buttonTap}>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-black/20 transition-colors hover:bg-neutral-100"
              >
                Get Started
              </Link>
            </motion.div>
            <motion.div whileHover={reduced ? undefined : buttonHover} whileTap={reduced ? undefined : buttonTap}>
              <Link
                href="/#how-it-works"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                How it Works
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
