import Link from 'next/link';
import { Check } from 'lucide-react';

const packages = [
  {
    name: 'Personal',
    price: '$9',
    period: 'per hour',
    description: 'For individuals and students looking to review their coursework.',
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
    description: 'For active students who need to review multiple subjects weekly.',
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
    description: 'For schools and academies that need to manage review across departments.',
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
        {/* Header */}
        <div className="mb-16 grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
              💳 Pricing
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
              Simple and Flexible Pricing
            </h1>
          </div>
          <div className="flex items-center justify-end">
            {/* Billing toggle placeholder */}
            <div className="inline-flex overflow-hidden rounded-lg border border-white/10">
              <button className="bg-white px-5 py-2.5 text-sm font-semibold text-black">
                One-time
              </button>
              <button className="bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-white">
                Subscription
              </button>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid items-start gap-6 lg:grid-cols-3">
          {packages.map((pkg) => (
            <div
              key={pkg.name}
              className={`rounded-2xl border p-8 transition-all ${
                pkg.highlighted
                  ? 'relative z-10 border-white/20 bg-white/[0.06] shadow-2xl shadow-black/30 lg:-my-4 lg:py-12'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              {pkg.label && (
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">{pkg.label}</p>
              )}
              <h3 className="mb-1 text-lg font-medium text-neutral-400">{pkg.name}</h3>

              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{pkg.price}</span>
                {pkg.period && <span className="text-sm text-neutral-500">{pkg.period}</span>}
              </div>

              <p className="mb-6 text-sm leading-relaxed text-neutral-500">{pkg.description}</p>

              <div className="mb-8 border-t border-white/[0.06] pt-6">
                <ul className="space-y-3">
                  {pkg.features.map((feature, i) => (
                    <li key={feature} className="flex items-start gap-3">
                      {i === 0 && pkg.highlighted ? (
                        <span className="text-sm font-semibold text-teal-400">{feature}</span>
                      ) : i === 0 && pkg.name === 'Custom Plan' ? (
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

              <Link
                href="/register"
                className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition-all ${
                  pkg.highlighted
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'border border-white/10 bg-white/[0.04] text-white hover:bg-white/10'
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-16 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <h3 className="mb-2 text-lg font-semibold text-white">Need a custom arrangement?</h3>
          <p className="text-sm text-neutral-500">
            Contact us for bulk credit provisioning, school-wide deployments, and custom subject library setup.
          </p>
          <Link
            href="/contact"
            className="mt-4 inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
          >
            Contact Sales
          </Link>
        </div>
      </div>
    </div>
  );
}
