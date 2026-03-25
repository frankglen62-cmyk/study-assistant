import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';

import { InteractiveCard } from '@/components/interactive-card';
import { ScrollReveal } from '@/components/scroll-reveal';

const packages = [
  {
    name: 'Personal',
    price: '$9',
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
    price: '$24',
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
    label: 'Beyond limits',
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
    <div className="bg-[#0a0a0a] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal className="relative mb-16 overflow-hidden rounded-[36px] border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-10 lg:p-14">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[8%] top-[10%] h-40 w-40 rounded-full bg-teal-400/10 blur-3xl animate-aurora" />
            <div className="absolute right-[10%] top-[16%] h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl animate-aurora [animation-duration:20s]" />
          </div>
          <div className="relative grid items-end gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
                <Sparkles className="h-4 w-4 text-teal-400" />
                Pricing
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
                Pricing with
                <span className="block bg-[linear-gradient(120deg,#5eead4,#2dd4bf,#67e8f9,#5eead4)] bg-[length:220%_220%] bg-clip-text text-transparent animate-shimmer">
                  premium hover motion
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-500">
                Every plan is presented with stronger depth, lift, and focus so visitors can scan
                the offers faster and feel the hierarchy immediately.
              </p>
            </div>
            <div className="flex items-center justify-start lg:justify-end">
              <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/[0.03] p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                <button className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/20">
                  One-time
                </button>
                <button className="rounded-full px-5 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-white">
                  Subscription
                </button>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          {packages.map((pkg, index) => (
            <ScrollReveal key={pkg.name} delay={index * 0.06} className="h-full">
              <InteractiveCard
                accent={pkg.highlighted ? 'rgba(45,212,191,0.2)' : 'rgba(45,212,191,0.12)'}
                borderAccent={pkg.highlighted ? 'rgba(94, 234, 212, 0.22)' : 'rgba(255,255,255,0.16)'}
                hoverLift={10}
                hoverScale={1.045}
                tiltIntensity={4}
                hoverShadow="0 28px 84px rgba(0, 0, 0, 0.42)"
                hoverBackgroundColor="rgba(255, 255, 255, 0.055)"
                className="flex h-full flex-col rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-8 shadow-[0_14px_48px_rgba(0,0,0,0.16)] transition-[border-color,background-color,box-shadow] duration-200 group-hover:border-white/[0.18]"
              >
                <div className="mb-4 min-h-[32px]">
                  {pkg.highlighted ? (
                    <div className="inline-flex rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
                      Most chosen
                    </div>
                  ) : pkg.label ? (
                    <p className="pt-1 text-xs font-medium uppercase tracking-[0.24em] text-neutral-500">
                      {pkg.label}
                    </p>
                  ) : (
                    <span aria-hidden="true" className="inline-block h-[26px]" />
                  )}
                </div>
                <h3 className="mb-1 text-lg font-medium text-neutral-400">{pkg.name}</h3>

                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">{pkg.price}</span>
                  {pkg.period ? <span className="text-sm text-neutral-500">{pkg.period}</span> : null}
                </div>

                <p className="mb-6 text-sm leading-relaxed text-neutral-500">{pkg.description}</p>

                <div className="mb-8 border-t border-white/[0.06] pt-6">
                  <ul className="space-y-3">
                    {pkg.features.map((feature, featureIndex) => (
                      <li key={feature} className="flex items-start gap-3">
                        {featureIndex === 0 && (pkg.highlighted || pkg.name === 'Custom Plan') ? (
                          <span className="text-sm font-semibold text-teal-400">{feature}</span>
                        ) : (
                          <>
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                            <span className="text-sm text-neutral-400">{feature}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto">
                  <Link
                    href="/register"
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 text-center text-sm font-semibold text-white transition-all group-hover:border-white/20 group-hover:bg-white group-hover:text-black hover:bg-white/10"
                  >
                    Get Started
                  </Link>
                </div>

              </InteractiveCard>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.1} className="mt-16">
          <InteractiveCard className="rounded-[30px] border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <h3 className="mb-2 text-lg font-semibold text-white">Need a custom arrangement?</h3>
            <p className="text-sm text-neutral-500">
              Contact us for bulk credit provisioning, school-wide deployments, and custom subject
              library setup.
            </p>
            <Link
              href="/contact"
              className="mt-4 inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
            >
              Contact Sales
            </Link>
          </InteractiveCard>
        </ScrollReveal>
      </div>
    </div>
  );
}
