'use client';

import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

import { ScrollReveal } from '@/components/scroll-reveal';
import { pricingCardHover, buttonHover, buttonTap } from '@/lib/motion';

const packages = [
  {
    name: 'Personal',
    price: '₱150',
    period: 'per hour',
    description: 'For focused solo review when you only need a compact session window.',
    highlighted: false,
    features: [
      '1 hour of active study time',
      'All subjects included',
      'Extension side panel access',
      'AI-powered answer suggestions',
      'Session auto-pause protection',
    ],
  },
  {
    name: 'Pro',
    price: '₱200',
    period: '3 hours',
    description: 'For active students who need stronger weekly coverage across multiple subjects.',
    highlighted: true,
    features: [
      'Everything in Personal, plus:',
      '3 hours of active study time',
      'Priority subject detection',
      'Multi-device pairing support',
      'Detailed confidence scoring',
      'Session history tracking',
    ],
  },
  {
    name: 'Custom Plan',
    price: 'Custom',
    period: '',
    description: 'For schools and teams that need a tailored rollout and controlled review setup.',
    highlighted: false,
    label: 'Enterprise',
    features: [
      'Everything in Standard & Pro, plus:',
      'Bulk credit provisioning',
      'Custom subject libraries',
      'Dedicated admin portal setup',
      'Priority support channel',
      'Unlimited Q&A pair imports',
    ],
  },
];

export default function PricingPage() {
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
            <Sparkles className="h-4 w-4 text-accent" />
            Pricing
          </span>
          <h1 className="font-display text-5xl leading-[1.1] text-foreground sm:text-6xl lg:text-7xl">
            Simple, fair pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Pay only for the time you use. No subscriptions, no hidden fees. Choose the plan
            that matches your study workload.
          </p>
        </ScrollReveal>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-stretch gap-6 lg:grid-cols-3">
            {packages.map((pkg, index) => (
              <ScrollReveal key={pkg.name} delay={index * 0.06} className="h-full cursor-pointer">
                <motion.div 
                  className={`flex h-full flex-col rounded-2xl border bg-white p-8 shadow-card transition-all duration-300 hover:shadow-card-hover group ${pkg.highlighted ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border/40'}`}
                  whileHover={pricingCardHover}
                >
                  <div className="mb-4 min-h-[32px]">
                    {pkg.highlighted ? (
                      <motion.span 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                      >
                        Most chosen
                      </motion.span>
                    ) : pkg.label ? (
                      <span className="inline-flex rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground group-hover:bg-muted/20 transition-colors">
                        {pkg.label}
                      </span>
                    ) : (
                      <span aria-hidden="true" className="inline-block h-[26px]" />
                    )}
                  </div>
                  <h3 className="mb-1 text-lg font-medium text-muted-foreground group-hover:text-foreground transition-colors">{pkg.name}</h3>

                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="font-display text-4xl text-foreground group-hover:text-accent transition-colors duration-300">{pkg.price}</span>
                    {pkg.period ? <span className="text-sm text-muted-foreground">{pkg.period}</span> : null}
                  </div>

                  <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{pkg.description}</p>

                  <div className="mb-8 border-t border-border/40 pt-6">
                    <ul className="space-y-3">
                      {pkg.features.map((feature, featureIndex) => (
                        <li key={feature} className="flex items-start gap-3">
                          {featureIndex === 0 && (pkg.highlighted || pkg.name === 'Custom Plan') ? (
                            <span className="text-sm font-semibold text-accent">{feature}</span>
                          ) : (
                            <>
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent transition-transform group-hover:scale-125 duration-300" />
                              <span className="text-sm text-muted-foreground">{feature}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <motion.div className="mt-auto" whileHover={buttonHover} whileTap={buttonTap}>
                    <Link
                      href="/register"
                      className={`block w-full rounded-full py-3 text-center text-sm font-semibold transition-all duration-200 ${pkg.highlighted ? 'bg-foreground text-background hover:bg-foreground/90 shadow-soft-sm' : 'border border-border bg-white text-foreground hover:bg-surface'}`}
                    >
                      Get Started
                    </Link>
                  </motion.div>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>

          {/* Custom CTA */}
          <ScrollReveal delay={0.1} className="mt-16">
            <div className="rounded-2xl border border-border/40 bg-white p-10 text-center shadow-card">
              <h3 className="mb-2 font-display text-2xl text-foreground">Need a custom arrangement?</h3>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                Contact us for bulk credit provisioning, school-wide deployments, and custom subject
                library setup.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background shadow-soft-sm transition-all duration-200 hover:bg-foreground/90 hover:shadow-soft-md"
                  >
                    Contact Sales
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
