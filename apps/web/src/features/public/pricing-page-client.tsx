'use client';

import Link from 'next/link';

import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

import { ScrollReveal } from '@/components/scroll-reveal';
import type { PaymentPackageDisplay } from '@/lib/payments/package-display';
import { buttonHover, buttonTap, pricingCardHover } from '@/lib/motion';

interface PricingPageClientProps {
  packages: PaymentPackageDisplay[];
}

export function PricingPageClient({ packages }: PricingPageClientProps) {
  return (
    <div className="overflow-hidden">
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
            Every public package on this page comes directly from the live admin payment catalog.
            Edit price, duration, or visibility once and the next page load will reflect it here.
          </p>
        </ScrollReveal>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          {packages.length > 0 ? (
            <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg, index) => (
                <ScrollReveal key={pkg.id} delay={index * 0.06} className="h-full cursor-pointer">
                  <motion.div
                    className={`group flex h-full flex-col rounded-2xl border bg-white p-8 shadow-card transition-all duration-300 hover:shadow-card-hover ${
                      pkg.featured ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border/40'
                    }`}
                    whileHover={pricingCardHover}
                  >
                    <div className="mb-4 flex min-h-[32px] items-center justify-between gap-2">
                      <span className="inline-flex rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground transition-colors group-hover:bg-muted/20">
                        {pkg.durationLabel}
                      </span>
                      {pkg.featured ? (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 }}
                          className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                        >
                          Most chosen
                        </motion.span>
                      ) : null}
                    </div>

                    <h3 className="mb-1 text-lg font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                      {pkg.name}
                    </h3>

                    <div className="mb-4 flex items-baseline gap-2">
                      <span className="font-display text-4xl text-foreground transition-colors duration-300 group-hover:text-accent">
                        {pkg.price}
                      </span>
                      <span className="text-sm text-muted-foreground">{pkg.durationLabel.toLowerCase()}</span>
                    </div>

                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{pkg.description}</p>

                    <div className="mb-8 border-t border-border/40 pt-6">
                      <ul className="space-y-3">
                        {[pkg.durationSummary, 'Instant credit delivery after payment', pkg.expirySummary, 'Works across the portal and extension'].map((feature) => (
                          <li key={feature} className="flex items-start gap-3">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent transition-transform duration-300 group-hover:scale-125" />
                            <span className="text-sm text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <motion.div className="mt-auto" whileHover={buttonHover} whileTap={buttonTap}>
                      <Link
                        href="/register"
                        className={`block w-full rounded-full py-3 text-center text-sm font-semibold transition-all duration-200 ${
                          pkg.featured
                            ? 'bg-foreground text-background shadow-soft-sm hover:bg-foreground/90'
                            : 'border border-border bg-white text-foreground hover:bg-surface'
                        }`}
                      >
                        Get Started
                      </Link>
                    </motion.div>
                  </motion.div>
                </ScrollReveal>
              ))}
            </div>
          ) : (
            <ScrollReveal>
              <div className="rounded-2xl border border-dashed border-border/50 bg-white p-10 text-center shadow-card">
                <h3 className="mb-2 font-display text-2xl text-foreground">No active packages yet</h3>
                <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                  Create or activate a payment package in the admin portal and it will appear here automatically.
                </p>
              </div>
            </ScrollReveal>
          )}

          <ScrollReveal delay={0.1} className="mt-16">
            <div className="rounded-2xl border border-border/40 bg-white p-10 text-center shadow-card">
              <h3 className="mb-2 font-display text-2xl text-foreground">Need a custom arrangement?</h3>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                Contact us for school rollouts, bulk provisioning, or custom study-library support.
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
