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
  Check,
} from 'lucide-react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

import { FaqAccordion } from '@/components/faq-accordion';
import { featureCards, faqItems, howItWorks, testimonials, pricingTeaser } from '@/features/public/content';
import {
  ease,
  heroContainer,
  heroBadgeReveal,
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

const heroCtaRow: Variants = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0.5, staggerChildren: 0.14 },
  },
};

const heroCtaItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: ease.out } },
};

export default function HomePage() {
  const reduced = useReducedMotion();

  return (
    <div className="overflow-hidden">
      {/* ═══════════════════════════════════════
         HERO SECTION — Inspired by Seriva
         ═══════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 via-background to-background pb-20 pt-12 lg:pt-20">
        {/* Subtle decorative blurs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-40 top-0 h-[600px] w-[600px] rounded-full bg-blue-100/40 blur-3xl" />
          <div className="absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-emerald-100/30 blur-3xl" />
        </div>

        <motion.div
          className="relative mx-auto max-w-7xl px-6"
          variants={heroContainer}
          initial={reduced ? undefined : 'hidden'}
          animate={reduced ? undefined : 'visible'}
        >
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <motion.div variants={heroBadgeReveal} className="mb-8 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-foreground shadow-soft-sm">
                <Sparkles className="h-4 w-4 text-accent" />
                AI-Powered Study Assistant
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={heroHeadlineReveal}
              className="font-display text-5xl leading-[1.1] text-foreground sm:text-6xl lg:text-7xl"
            >
              Smarter reviewing,{' '}
              <span className="text-accent">better results.</span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              variants={heroTextReveal}
              className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            >
              Your portal, extension, and subject-based review flow in one clean workspace.
              Stay focused on what matters — studying.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={reduced ? undefined : heroCtaRow}
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
            >
              <motion.div variants={reduced ? undefined : heroCtaItem}>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background shadow-soft-md transition-all duration-200 hover:bg-foreground/90 hover:shadow-soft-lg"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <motion.div variants={reduced ? undefined : heroCtaItem}>
                <Link
                  href="/#how-it-works"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-7 py-3.5 text-sm font-semibold text-foreground shadow-soft-sm transition-all duration-200 hover:shadow-soft-md"
                >
                  How it Works
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* ─── Floating Feature Cards ─── */}
          <motion.div
            variants={trustStripReveal}
            className="relative mx-auto mt-16 max-w-5xl"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <motion.div
                className="rounded-2xl border border-border/40 bg-white p-5 shadow-card"
                animate={reduced ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Subject Detection</h3>
                <p className="mt-1 text-xs text-muted-foreground">Auto-detects what you're studying</p>
              </motion.div>

              <motion.div
                className="rounded-2xl border border-border/40 bg-white p-5 shadow-card sm:mt-8"
                animate={reduced ? undefined : { y: [0, -8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <MonitorSmartphone className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Browser Extension</h3>
                <p className="mt-1 text-xs text-muted-foreground">Clean side panel for fast review</p>
              </motion.div>

              <motion.div
                className="rounded-2xl border border-border/40 bg-white p-5 shadow-card"
                animate={reduced ? undefined : { y: [0, -5, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Private by Design</h3>
                <p className="mt-1 text-xs text-muted-foreground">Admin-controlled, student-safe</p>
              </motion.div>
            </div>
          </motion.div>

          {/* ─── Platform Strip ─── */}
          <motion.div variants={trustStripReveal} className="mx-auto mt-16 max-w-3xl text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Built for content from leading platforms
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {['Coursera', 'Course Hero', 'Scribd', 'Studocu', 'Chegg'].map((name) => (
                <span key={name} className="text-lg font-semibold text-muted-foreground/50 transition-colors hover:text-muted-foreground">
                  {name}
                </span>
              ))}
            </div>
            <p className="mx-auto mt-4 max-w-xl text-xs text-muted-foreground/60">
              Third-party names remain the property of their respective owners. Mention describes
              familiar study formats only.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
         FEATURES SECTION
         ═══════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.2 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 mb-6">
              <Sparkles className="h-4 w-4" />
              Features
            </span>
            <h2 className="font-display text-4xl text-foreground sm:text-5xl">
              A cleaner study workspace
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
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
                  <div className="group rounded-2xl border border-border/40 bg-white p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
         HOW IT WORKS
         ═══════════════════════════════════════ */}
      <section id="how-it-works" className="border-t border-border/40 bg-surface/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.2 }}
          >
            <h2 className="font-display text-4xl text-foreground sm:text-5xl">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
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
                <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-card transition-all duration-300 hover:shadow-card-hover">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                    {item.step}
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
         PRICING PREVIEW
         ═══════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.2 }}
          >
            <h2 className="font-display text-4xl text-foreground sm:text-5xl">
              Simple, fair pricing
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Pay only for the time you use. No subscriptions, no hidden fees.
            </p>
          </motion.div>

          <motion.div
            className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-3"
            variants={staggerContainer}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.15 }}
          >
            {pricingTeaser.map((item, index) => (
              <motion.div key={item.name} variants={staggerItem}>
                <div className={`rounded-2xl border bg-white p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 ${index === 1 ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border/40'}`}>
                  {index === 1 && (
                    <span className="mb-4 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                      Most Popular
                    </span>
                  )}
                  <p className="text-sm font-medium text-muted-foreground">{item.name}</p>
                  <p className="mt-2 font-display text-4xl text-foreground">{item.amount}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                  <div className="mt-6 space-y-2.5">
                    {['Instant credit delivery', 'Credits never expire', 'Full model access'].map((feat) => (
                      <div key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-accent" />
                        {feat}
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/register"
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold transition-all duration-200 ${index === 1 ? 'bg-foreground text-background hover:bg-foreground/90' : 'border border-border bg-white text-foreground hover:bg-surface'}`}
                  >
                    Get Started
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
         TESTIMONIALS
         ═══════════════════════════════════════ */}
      <section className="border-t border-border/40 bg-surface/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.2 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 mb-6">
              <Star className="h-4 w-4" />
              Testimonials
            </span>
            <h2 className="font-display text-4xl text-foreground sm:text-5xl">
              What our users say
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
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
                <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-card">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{item.rating}</span>
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-foreground/80">&quot;{item.quote}&quot;</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                      {item.name
                        .split(' ')
                        .map((chunk) => chunk[0])
                        .join('')}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.role}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
         FAQ
         ═══════════════════════════════════════ */}
      <section id="faq" className="py-24">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div
            className="mb-16 text-center"
            variants={sectionReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.25 }}
          >
            <h2 className="font-display text-4xl text-foreground sm:text-5xl">
              Frequently asked questions
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
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

      {/* ═══════════════════════════════════════
         FINAL CTA
         ═══════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-t from-blue-50/50 via-background to-background py-24">
        <motion.div
          className="relative mx-auto max-w-3xl px-6 text-center"
          variants={heroContainer}
          initial={reduced ? undefined : 'hidden'}
          whileInView={reduced ? undefined : 'visible'}
          viewport={{ once: true, amount: 0.25 }}
        >
          <motion.h2
            variants={heroHeadlineReveal}
            className="font-display text-4xl text-foreground sm:text-5xl"
          >
            Ready to study smarter?
          </motion.h2>
          <motion.p variants={heroTextReveal} className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join learners using a cleaner, subject-focused review workspace.
          </motion.p>
          <motion.div
            variants={reduced ? undefined : heroCtaRow}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div variants={reduced ? undefined : heroCtaItem}>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background shadow-soft-md transition-all duration-200 hover:bg-foreground/90 hover:shadow-soft-lg"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div variants={reduced ? undefined : heroCtaItem}>
              <Link
                href="/#how-it-works"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-7 py-3.5 text-sm font-semibold text-foreground shadow-soft-sm transition-all duration-200 hover:shadow-soft-md"
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
