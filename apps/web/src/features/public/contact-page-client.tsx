'use client';

import { ArrowRight, Mail, MessageSquareText, ShieldEllipsis, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { ScrollReveal } from '@/components/scroll-reveal';
import { cardHover, cardTap } from '@/lib/motion';
import { ContactForm } from '@/features/public/contact-form';

interface ContactPageClientProps {
  supportEmail: string;
}

export function ContactPageClient({ supportEmail }: ContactPageClientProps) {
  const channels = [
    {
      icon: Mail,
      title: 'Email Support',
      description: supportEmail,
      href: `mailto:${supportEmail}`,
    },
    {
      icon: MessageSquareText,
      title: 'Implementation Reviews',
      description:
        'Rollout guidance, portal setup help, and workflow planning for new deployments.',
    },
    {
      icon: ShieldEllipsis,
      title: 'Security Requests',
      description:
        'Questions about private storage, access controls, audit trails, and protected content.',
    },
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 via-background to-background pb-16 pt-24">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-blue-100/40 blur-3xl" />
          <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-emerald-100/30 blur-3xl" />
        </div>

        <ScrollReveal eager className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-8 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-foreground shadow-soft-sm">
              <Sparkles className="h-4 w-4 text-accent" />
              Support
            </span>
            <h1 className="font-display text-5xl leading-[1.1] text-foreground sm:text-6xl lg:text-7xl">
              Get in touch
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Use this channel for onboarding questions, rollout guidance, security inquiries, and
              support escalations.
            </p>
          </div>
        </ScrollReveal>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Info Cards */}
            <div className="space-y-5">
              {channels.map((channel, index) => {
                const Icon = channel.icon;
                const cardBody = (
                  <motion.div
                    className="group rounded-2xl border border-border/40 bg-white p-6 shadow-card transition-all duration-300 hover:shadow-card-hover cursor-pointer"
                    whileHover={cardHover}
                    whileTap={cardTap}
                  >
                    <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-all group-hover:bg-accent group-hover:text-white group-hover:scale-110 group-hover:-rotate-3 duration-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-1 text-base font-semibold text-foreground group-hover:text-accent transition-colors">
                      {channel.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {channel.description}
                    </p>
                  </motion.div>
                );
                return (
                  <ScrollReveal key={channel.title} delay={index * 0.06}>
                    {channel.href ? (
                      <a href={channel.href} className="block">
                        {cardBody}
                      </a>
                    ) : (
                      cardBody
                    )}
                  </ScrollReveal>
                );
              })}

              {/* Quick links */}
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl border border-border/40 bg-surface/50 p-6">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Quick links</h3>
                  <div className="space-y-2">
                    <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
                      <Link
                        href="/features"
                        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowRight className="h-3.5 w-3.5" /> Explore features
                      </Link>
                    </motion.div>
                    <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
                      <Link
                        href="/pricing"
                        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowRight className="h-3.5 w-3.5" /> View pricing
                      </Link>
                    </motion.div>
                    <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
                      <Link
                        href="/#faq"
                        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowRight className="h-3.5 w-3.5" /> Read FAQ
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* Form */}
            <ScrollReveal delay={0.08}>
              <ContactForm />
            </ScrollReveal>
          </div>
        </div>
      </section>
    </div>
  );
}
