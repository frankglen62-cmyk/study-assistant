import { Mail, MessageSquareText, ShieldEllipsis } from 'lucide-react';

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
    description: 'Source library setup, extension rollout, and billing configuration guidance.',
  },
  {
    icon: ShieldEllipsis,
    title: 'Security Requests',
    description: 'Ask about private storage, source controls, audit logging, and access boundaries.',
  },
];

export default function ContactPage() {
  return (
    <div className="bg-[#0a0a0a] py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
              💬 Support
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Talk to the Team
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-neutral-500">
              Use this channel for onboarding, support escalation, and architecture questions around billing, source
              ingestion, and extension rollout.
            </p>
          </div>

          <div className="space-y-4">
            {channels.map((ch) => {
              const Icon = ch.icon;
              return (
                <div
                  key={ch.title}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-white/10"
                >
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-white">{ch.title}</h3>
                  <p className="text-sm text-neutral-500">{ch.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
