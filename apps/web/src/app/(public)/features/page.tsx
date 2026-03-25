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

import { InteractiveCard } from '@/components/interactive-card';
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
    <div className="bg-[#0a0a0a] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal className="relative mb-20 overflow-hidden rounded-[36px] border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-12 text-center lg:p-20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[8%] top-[8%] h-40 w-40 rounded-full bg-teal-400/10 blur-3xl animate-aurora" />
            <div className="absolute right-[10%] top-[20%] h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl animate-aurora [animation-duration:22s]" />
          </div>
          <div className="relative">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
              <Zap className="h-4 w-4 text-teal-400" />
              Features
            </div>
            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              A Controlled AI Workflow with
              <span className="block bg-[linear-gradient(120deg,#5eead4,#2dd4bf,#67e8f9,#5eead4)] bg-[length:220%_220%] bg-clip-text text-transparent animate-shimmer">
                Futuristic Motion
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-500">
              Every major surface is designed around clarity, speed, and a more premium public
              experience without exposing the internals behind the workflow.
            </p>
          </div>
        </ScrollReveal>

        <div className="mb-16 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <ScrollReveal amount={0.14}>
            <InteractiveCard className="rounded-[30px] border border-white/[0.06] bg-white/[0.02] p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-400/90">
                Feature system
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Built for polished movement, cleaner focus, and safer study flows.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-500">
                The public experience now leans into layered gradients, responsive hover depth,
                page transitions, and cleaner section pacing to feel more intentional on every tab.
              </p>
            </InteractiveCard>
          </ScrollReveal>

          <div className="grid gap-6">
            {workflow.map((item, index) => {
              const Icon = item.icon;
              return (
                <ScrollReveal key={item.title} delay={index * 0.08}>
                  <InteractiveCard className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-6">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-neutral-500">{item.description}</p>
                  </InteractiveCard>
                </ScrollReveal>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <ScrollReveal key={section.title} delay={(index % 3) * 0.06}>
                <InteractiveCard className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-8">
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400 transition-colors group-hover:bg-teal-500/20">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-white">{section.title}</h3>
                  <p className="text-sm leading-relaxed text-neutral-500">{section.description}</p>
                </InteractiveCard>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </div>
  );
}
