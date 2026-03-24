'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BrainCircuit,
  BookOpenText,
  CheckCircle2,
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

import { featureCards, howItWorks, testimonials, faqItems } from '@/features/public/content';
import { FaqAccordion } from '@/components/faq-accordion';
import {
  heroContainer,
  heroBadgeReveal,
  heroHeadlineReveal,
  heroTextReveal,
  heroCtaReveal,
  heroPanelReveal,
  heroPanelItemStagger,
  heroPanelItem,
  trustStripReveal,
  trustItemStagger,
  sectionReveal,
  staggerContainer,
  staggerItem,
  cardHover,
  buttonHover,
  buttonTap,
  footerReveal,
  footerStagger,
  ease,
} from '@/lib/motion';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BrainCircuit,
  FolderTree,
  WalletCards,
  MonitorSmartphone,
  Sparkles,
  ShieldCheck,
};

/* ═══════════════════════════════════════════
   Subject preview data for the hero panel
   ═══════════════════════════════════════════ */
const previewSubjects = [
  { name: 'Calculus-Based Physics 2', count: 156, active: true },
  { name: 'Software Engineering 1', count: 224, active: false },
  { name: 'Information Assurance & Security', count: 189, active: false },
];

const previewQA = [
  { q: 'The SI unit of electric charge is…', a: 'Coulomb (C)', confidence: 96 },
  { q: 'Which SDLC model allows iterative…', a: 'Spiral Model', confidence: 91 },
];

/* ═══════════════════════════════════════════
   Platform Ticker Component
   ═══════════════════════════════════════════ */
function PlatformTicker() {
  const platforms = [
    {
      name: 'Coursera',
      el: <span className="text-2xl font-bold tracking-tight text-[#0056D2]">coursera</span>,
    },
    {
      name: 'Course Hero',
      el: (
        <div className="flex items-center gap-2">
          <svg width="22" height="26" viewBox="0 0 24 28" fill="#00249C">
            <path d="M0 0v21.5l12 6.5 12-6.5V0H0zm12 21.8l-7.5-4.1.8-6.8L0 6.2l7-1.3L12 0l2.5 4.9 7 1.3-5.3 4.7.8 6.8-7.5 4.1z" />
            <path fill="white" d="M12 2.6l-2 3.8-5.3 1 4 3.6-.6 5L12 14l3.9 1.9-.6-5 4-3.6-5.3-1z" />
          </svg>
          <span className="font-serif text-[22px] font-bold tracking-tight text-[#00249C]">
            Course Hero
          </span>
        </div>
      ),
    },
    {
      name: 'Scribd',
      el: (
        <div className="flex items-center gap-1.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#1A7B85">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
          <span className="text-[20px] font-medium tracking-[0.1em] text-[#001D24]">
            SCRIBD
          </span>
        </div>
      ),
    },
    {
      name: 'Studocu',
      el: (
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#111111">
            <path d="M16 6C16 3.79 14.21 2 12 2H8C5.79 2 4 3.79 4 6V11C4 13.21 5.79 15 8 15H16C18.21 15 20 16.79 20 19V24H12C9.79 24 8 22.21 8 20V15C8 12.79 9.79 11 12 11H16C18.21 11 20 9.21 20 7V2H16V6Z" />
          </svg>
          <span className="text-2xl font-bold tracking-tight text-[#111111]">
            studocu
          </span>
        </div>
      ),
    },
    {
      name: 'Chegg',
      el: <span className="text-3xl font-bold tracking-tighter text-[#EB7100]">Chegg</span>,
    },
  ];

  return (
    <div className="relative mx-auto mt-10 w-full max-w-5xl overflow-hidden before:absolute before:left-0 before:top-0 before:z-10 before:h-full before:w-20 before:bg-gradient-to-r before:from-[#0a0a0a] before:to-transparent after:absolute after:right-0 after:top-0 after:z-10 after:h-full after:w-20 after:bg-gradient-to-l after:from-[#0a0a0a] after:to-transparent">
      <div className="flex w-[200%] animate-marquee-right items-center">
        <div className="flex w-1/2 items-center justify-around px-2">
          {platforms.map((p) => (
            <div
              key={p.name}
              className="flex h-14 min-w-[160px] items-center justify-center rounded-xl bg-white px-6 shadow-md transition-transform hover:scale-105"
            >
              {p.el}
            </div>
          ))}
        </div>
        <div className="flex w-1/2 items-center justify-around px-2">
          {platforms.map((p) => (
            <div
              key={`copy-${p.name}`}
              className="flex h-14 min-w-[160px] items-center justify-center rounded-xl bg-white px-6 shadow-md transition-transform hover:scale-105"
            >
              {p.el}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const reduced = useReducedMotion();

  /* If reduced motion, render everything static */
  const m = reduced
    ? { initial: undefined, animate: undefined, whileInView: undefined, variants: undefined }
    : {};

  return (
    <div className="overflow-hidden bg-[#0a0a0a]">
      {/* ════════════════════════════════════════════════
          SECTION 1 — HERO
          ════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-gradient-to-b from-teal-500/[0.08] via-cyan-500/[0.05] to-transparent blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        </div>

        {/* Floating accent icons — desktop only, subtle */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <motion.div
            className="absolute left-[8%] top-[22%] rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm"
            animate={reduced ? undefined : { y: [0, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <GraduationCap className="h-6 w-6 text-neutral-600" />
          </motion.div>
          <motion.div
            className="absolute right-[10%] top-[16%] rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm"
            animate={reduced ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          >
            <Sparkles className="h-6 w-6 text-neutral-600" />
          </motion.div>
          <motion.div
            className="absolute left-[5%] top-[60%] rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm"
            animate={reduced ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          >
            <BookOpenText className="h-6 w-6 text-neutral-600" />
          </motion.div>
          <motion.div
            className="absolute right-[7%] top-[55%] rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-2xl backdrop-blur-sm"
            animate={reduced ? undefined : { y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          >
            <ShieldCheck className="h-6 w-6 text-neutral-600" />
          </motion.div>
        </div>

        {/* Hero content */}
        <motion.div
          className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 text-center lg:pt-32"
          variants={heroContainer}
          initial={reduced ? undefined : 'hidden'}
          animate={reduced ? undefined : 'visible'}
        >
          {/* Eyebrow */}
          <motion.div
            variants={heroBadgeReveal}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400 backdrop-blur-sm"
          >
            <Zap className="h-4 w-4 text-teal-400" />
            <span>Discover the AI-powered Study Assistant</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={heroHeadlineReveal}
            className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            One Workspace For{' '}
            <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
              Faster Subject Review
            </span>
          </motion.h1>

          {/* Supporting text */}
          <motion.p
            variants={heroTextReveal}
            className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-neutral-400"
          >
            Study Assistant keeps your portal, extension, and subject-based review flow in one clean
            experience so learners can stay focused without exposing the internal structure behind
            the system.
          </motion.p>

          {/* CTAs */}
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

          {/* ── Product preview panel ── */}
          <motion.div
            variants={heroPanelReveal}
            className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          >
            {/* Browser dots */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
              <span className="ml-3 text-xs text-neutral-600">studyassistant.app/admin/sources</span>
            </div>

            <motion.div
              variants={heroPanelItemStagger}
              initial={reduced ? undefined : 'hidden'}
              animate={reduced ? undefined : 'visible'}
              className="grid gap-0 md:grid-cols-[260px_1fr]"
            >
              {/* Left: subjects sidebar */}
              <div className="border-b border-white/[0.06] p-5 md:border-b-0 md:border-r">
                <motion.p variants={heroPanelItem} className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600">
                  Subject Library
                </motion.p>
                <div className="space-y-2">
                  {previewSubjects.map((s) => (
                    <motion.div
                      key={s.name}
                      variants={heroPanelItem}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                        s.active
                          ? 'border border-teal-500/20 bg-teal-500/[0.08] text-teal-300'
                          : 'text-neutral-500 hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.active ? 'bg-teal-500/20 text-teal-400' : 'bg-white/[0.04] text-neutral-600'}`}>
                        {s.count}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Right: Q&A preview */}
              <div className="p-5">
                <motion.div variants={heroPanelItem} className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600">Q&A Pairs</p>
                  <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-bold text-teal-400">
                    156 items
                  </span>
                </motion.div>
                <div className="space-y-2">
                  {previewQA.map((qa) => (
                    <motion.div
                      key={qa.q}
                      variants={heroPanelItem}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <p className="text-sm text-neutral-300">{qa.q}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-teal-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {qa.a}
                        </span>
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-600">
                          {qa.confidence}% confidence
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* ── Trust strip (inside hero) ── */}
          <motion.div
            variants={trustStripReveal}
            className="mx-auto mt-14 max-w-4xl"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-400/90">
              Access content from leading platforms — all in one place
            </p>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-neutral-500 sm:text-base">
              Built for study workflows familiar to learners across Coursera, Course Hero, Scribd,
              Studocu, and Chegg, while keeping everything organized inside one controlled review
              experience.
            </p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              <PlatformTicker />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════
          SECTION 2 — FEATURES
          ════════════════════════════════════════════════ */}
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
                <motion.div
                  key={feature.title}
                  variants={staggerItem}
                  whileHover={reduced ? undefined : cardHover}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 transition-colors group-hover:bg-teal-500/20">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-neutral-500">{feature.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS
          ════════════════════════════════════════════════ */}
      <section id="how-it-works" className="border-t border-white/[0.06] bg-[#0a0a0a] py-24">
        <div className="mx-auto max-w-7xl px-6">
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
              A simple flow from setup to a cleaner, subject-based review session.
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
              <motion.div
                key={item.step}
                variants={staggerItem}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-white/[0.09]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-400">
                  {item.step}
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-500">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          SECTION 4 — TESTIMONIALS
          ════════════════════════════════════════════════ */}
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
              Here&apos;s what students and administrators say about our platform.
            </p>
          </motion.div>

          <motion.div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            variants={staggerContainer}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.1 }}
          >
            {testimonials.map((t) => (
              <motion.div
                key={t.name}
                variants={staggerItem}
                whileHover={reduced ? undefined : cardHover}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-white/10"
              >
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-teal-400 text-teal-400" />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-neutral-400">{t.rating}</span>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-neutral-300">
                  &quot;{t.quote}&quot;
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-bold text-white">
                    {t.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{t.name}</div>
                    <div className="text-xs text-neutral-500">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          SECTION 5 — FAQ
          ════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════
          SECTION 6 — BOTTOM CTA
          ════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#0a0a0a] py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-teal-500/[0.06] to-cyan-500/[0.04] blur-3xl" />
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
          <motion.p
            variants={heroTextReveal}
            className="mx-auto mt-4 max-w-xl text-neutral-500"
          >
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
