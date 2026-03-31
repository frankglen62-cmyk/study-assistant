import { Mail, MessageSquareText, ShieldEllipsis, Sparkles } from 'lucide-react';

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
    <div className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Hero */}
        <ScrollReveal className="relative mb-14 text-center lg:text-left">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute left-[10%] top-[10%] h-48 w-48 rounded-full bg-blue-100/40 blur-3xl" />
            <div className="absolute right-[8%] top-[15%] h-56 w-56 rounded-full bg-emerald-100/30 blur-3xl" />
          </div>
          <div className="relative max-w-3xl">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              <Sparkles className="h-4 w-4" />
              Support
            </span>
            <h1 className="font-display text-4xl text-foreground sm:text-5xl">
              Get in touch
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Use this channel for onboarding questions, rollout guidance, security inquiries, and
              support escalations.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Info Cards */}
          <div className="space-y-6">
            {channels.map((channel, index) => {
              const Icon = channel.icon;
              return (
                <ScrollReveal key={channel.title} delay={index * 0.06}>
                  <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
                    <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-1 text-base font-semibold text-foreground">{channel.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{channel.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          {/* Form */}
          <ScrollReveal delay={0.08}>
            <div className="rounded-2xl border border-border/40 bg-white p-2 shadow-card">
              <ContactForm />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
