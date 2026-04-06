'use client';

import type { ComponentType } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  FolderTree,
  Layers3,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { ScrollReveal } from '@/components/scroll-reveal';
import { cardHover, cardTap, buttonHover, buttonTap } from '@/lib/motion';

const sections = [
  {
    icon: BrainCircuit,
    title: 'Subject-Aware Retrieval',
    description:
      'Answers route through subject and context signals so the workspace stays aligned to the course you are actually reviewing.',
  },
  {
    icon: FolderTree,
    title: 'Admin-Managed Source Library',
    description:
      'Private study references stay organized inside a controlled library structure built for clean updates and reliable reuse.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Extension Side Panel',
    description:
      'Review actions, current subject, answer confidence, and session tools stay inside one compact browser workspace.',
  },
  {
    icon: WalletCards,
    title: 'Flexible Usage Credits',
    description:
      'Time-based credits make access easier to manage while keeping sessions visible, measurable, and easier to control.',
  },
  {
    icon: ShieldCheck,
    title: 'Client-Safe Boundaries',
    description:
      'The system is designed to expose only the study outputs needed by learners while keeping protected content behind the portal.',
  },
  {
    icon: Sparkles,
    title: 'Guided Detection',
    description:
      'Manual subject picking and smart detection work together so the side panel can respond faster and more accurately.',
  },
];

const workflow = [
  {
    icon: Layers3,
    title: 'Portal + Extension in sync',
    description:
      'The public site, portal, and browser workflow feel like one system rather than disconnected tools.',
  },
  {
    icon: Zap,
    title: 'Faster route switching',
    description:
      'Public pages use smoother transitions, staged reveals, and lighter navigation handoffs for a more polished feel.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 via-background to-background pb-16 pt-24">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-blue-100/40 blur-3xl" />
          <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-emerald-100/30 blur-3xl" />
        </div>

        <ScrollReveal className="relative mx-auto max-w-7xl px-6 text-center">
          <span className="mb-8 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-foreground shadow-soft-sm">
            <Zap className="h-4 w-4 text-accent" />
            Features
          </span>
          <h1 className="mx-auto max-w-4xl font-display text-5xl leading-[1.1] text-foreground sm:text-6xl lg:text-7xl">
            A controlled AI workflow with{' '}
            <span className="text-accent">cleaner motion</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Every major surface is designed around clarity, speed, and a more premium public
            experience without exposing the internals behind the workflow.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <motion.div whileHover={buttonHover} whileTap={buttonTap}>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background shadow-soft-md transition-all duration-200 hover:bg-foreground/90 hover:shadow-soft-lg"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={buttonHover} whileTap={buttonTap}>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-7 py-3.5 text-sm font-semibold text-foreground shadow-soft-sm transition-all duration-200 hover:shadow-soft-md"
              >
                View Pricing
              </Link>
            </motion.div>
          </div>
        </ScrollReveal>
      </section>

      {/* Top Grid */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <ScrollReveal amount={0.14}>
              <div className="flex h-full flex-col justify-center rounded-2xl border border-border/40 bg-white p-10 shadow-card">
                <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Feature system
                </span>
                <h2 className="font-display text-3xl text-foreground sm:text-4xl">
                  Built for polished movement, cleaner focus, and safer study flows.
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  The public experience leans into layered gradients, responsive hover depth,
                  page transitions, and cleaner section pacing to feel more intentional on every tab.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid gap-6">
              {workflow.map((item, index) => {
                const Icon = item.icon;
                return (
                  <ScrollReveal key={item.title} delay={index * 0.08}>
                    <motion.div 
                      className="group rounded-2xl border border-border/40 bg-white p-6 shadow-card transition-all duration-300 hover:shadow-card-hover cursor-pointer"
                      whileHover={cardHover}
                      whileTap={cardTap}
                    >
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:scale-110 group-hover:-rotate-3 duration-300">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                    </motion.div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>

          {/* Feature Grid */}
          <ScrollReveal className="mb-6 text-center">
            <h2 className="font-display text-3xl text-foreground sm:text-4xl">
              Core capabilities
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Everything you need for a cleaner subject-based review workflow.
            </p>
          </ScrollReveal>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <ScrollReveal key={section.title} delay={(index % 3) * 0.06}>
                  <motion.div 
                    className="group h-full rounded-2xl border border-border/40 bg-white p-8 shadow-card transition-all duration-300 hover:shadow-card-hover cursor-pointer"
                    whileHover={cardHover}
                    whileTap={cardTap}
                  >
                    <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:scale-110 group-hover:rotate-3 duration-300">
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="mb-3 text-lg font-semibold text-foreground">{section.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{section.description}</p>
                  </motion.div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-t from-blue-50/50 via-background to-background py-24">
        <ScrollReveal className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-4xl text-foreground sm:text-5xl">
            Ready to explore?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            See how a cleaner subject-based workflow transforms your review experience.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <motion.div whileHover={buttonHover} whileTap={buttonTap}>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background shadow-soft-md transition-all duration-200 hover:bg-foreground/90 hover:shadow-soft-lg"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={buttonHover} whileTap={buttonTap}>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-7 py-3.5 text-sm font-semibold text-foreground shadow-soft-sm transition-all duration-200 hover:shadow-soft-md"
              >
                Contact Us
              </Link>
            </motion.div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
