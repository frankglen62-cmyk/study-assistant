import { Mail, MessageSquareText, ShieldEllipsis, Sparkles } from 'lucide-react';

import { InteractiveCard } from '@/components/interactive-card';
import { ScrollReveal } from '@/components/scroll-reveal';
import { ContactForm } from '@/features/public/contact-form';

const channels = [
  {
    icon: Mail,
    title: 'Email Support',
    description: 'support@studyassistant.example',
  },
  {
    icon: MessageSquareText,
    title: 'Implementation Reviews',
    description: 'Rollout guidance, portal setup help, and workflow planning for new deployments.',
  },
  {
    icon: ShieldEllipsis,
    title: 'Security Requests',
    description: 'Questions about private storage, access controls, audit trails, and protected content.',
  },
];

export default function ContactPage() {
  return (
    <div className="bg-[#0a0a0a] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal className="relative mb-14 overflow-hidden rounded-[36px] border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-10 lg:p-14">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[10%] top-[12%] h-40 w-40 rounded-full bg-teal-400/10 blur-3xl animate-aurora" />
            <div className="absolute right-[8%] top-[18%] h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl animate-aurora [animation-duration:20s]" />
          </div>
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
              <Sparkles className="h-4 w-4 text-teal-400" />
              Support
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              A smoother way to
              <span className="block bg-[linear-gradient(120deg,#5eead4,#2dd4bf,#67e8f9,#5eead4)] bg-[length:220%_220%] bg-clip-text text-transparent animate-shimmer">
                reach the team
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-500">
              Use this channel for onboarding questions, rollout guidance, security inquiries, and
              support escalations without leaving the premium portal flow.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            {channels.map((channel, index) => {
              const Icon = channel.icon;
              return (
                <ScrollReveal key={channel.title} delay={index * 0.06}>
                  <InteractiveCard className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-6">
                    <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-1 text-base font-semibold text-white">{channel.title}</h3>
                    <p className="text-sm leading-7 text-neutral-500">{channel.description}</p>
                  </InteractiveCard>
                </ScrollReveal>
              );
            })}
          </div>

          <ScrollReveal delay={0.08}>
            <div className="rounded-[34px] border border-white/[0.06] bg-white/[0.02] p-2">
              <ContactForm />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
