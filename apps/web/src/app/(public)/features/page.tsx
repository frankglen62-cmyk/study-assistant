import {
  BrainCircuit,
  FolderTree,
  Layers3,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from 'lucide-react';

import { ScrollReveal } from '@/components/scroll-reveal';

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
    <div className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Hero */}
        <ScrollReveal className="relative mb-20 text-center">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute left-[10%] top-[10%] h-60 w-60 rounded-full bg-blue-100/40 blur-3xl" />
            <div className="absolute right-[10%] top-[15%] h-48 w-48 rounded-full bg-emerald-100/30 blur-3xl" />
          </div>
          <div className="relative">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              <Zap className="h-4 w-4" />
              Features
            </span>
            <h1 className="mx-auto max-w-4xl font-display text-4xl text-foreground sm:text-5xl lg:text-6xl">
              A controlled AI workflow with{' '}
              <span className="text-accent">cleaner motion</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Every major surface is designed around clarity, speed, and a more premium public
              experience without exposing the internals behind the workflow.
            </p>
          </div>
        </ScrollReveal>

        {/* Top Grid */}
        <div className="mb-16 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <ScrollReveal amount={0.14}>
            <div className="rounded-2xl border border-border/40 bg-white p-8 shadow-card">
              <span className="text-xs font-medium uppercase tracking-wider text-accent">Feature system</span>
              <h2 className="mt-4 font-display text-3xl text-foreground">
                Built for polished movement, cleaner focus, and safer study flows.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
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
                  <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <ScrollReveal key={section.title} delay={(index % 3) * 0.06}>
                <div className="group rounded-2xl border border-border/40 bg-white p-8 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-foreground">{section.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{section.description}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </div>
  );
}
