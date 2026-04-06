'use client';

import Link from 'next/link';

import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

import type { PaymentPackageDisplay } from '@/lib/payments/package-display';
import { buttonHover, buttonTap, pricingCardHover, staggerContainer, staggerItem } from '@/lib/motion';

interface PublicPricingPreviewProps {
  packages: PaymentPackageDisplay[];
}

export function PublicPricingPreview({ packages }: PublicPricingPreviewProps) {
  if (packages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-surface/30 p-8 text-center text-sm text-muted-foreground">
        Pricing packages will appear here once an active package is saved in the admin portal.
      </div>
    );
  }

  return (
    <motion.div
      className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 xl:grid-cols-3"
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
    >
      {packages.map((item) => (
        <motion.div key={item.id} variants={staggerItem} whileHover={pricingCardHover} className="cursor-pointer">
          <div
            className={`group flex h-full flex-col rounded-2xl border bg-white p-6 shadow-card transition-all duration-300 hover:shadow-card-hover ${
              item.featured ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border/40'
            }`}
          >
            <div className="mb-4 flex min-h-[32px] items-center justify-between gap-2">
              <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                {item.durationLabel}
              </span>
              {item.featured ? (
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Most Popular
                </span>
              ) : null}
            </div>
            <p className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              {item.name}
            </p>
            <p className="mt-2 font-display text-4xl text-foreground transition-colors duration-300 group-hover:text-accent">
              {item.price}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            <div className="mt-6 space-y-2.5 flex-1">
              {[item.durationSummary, 'Instant credit delivery', 'Credits never expire'].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-accent transition-transform duration-300 group-hover:scale-125" />
                  {feature}
                </div>
              ))}
            </div>
            <motion.div whileHover={buttonHover} whileTap={buttonTap} className="mt-6 w-full">
              <Link
                href="/register"
                className={`inline-flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold transition-all duration-200 ${
                  item.featured
                    ? 'bg-foreground text-background hover:bg-foreground/90'
                    : 'border border-border bg-white text-foreground hover:bg-surface'
                }`}
              >
                Get Started
              </Link>
            </motion.div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
