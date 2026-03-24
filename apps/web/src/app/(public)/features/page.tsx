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

const sections = [
  {
    icon: BrainCircuit,
    title: 'Subject-Aware Retrieval',
    description:
      'Answers are routed by manual override, URL rules, course code hints, keywords, and model-assisted classification before retrieval begins.',
  },
  {
    icon: FolderTree,
    title: 'Admin-Managed Source Library',
    description:
      'Admins organize subject roots, categories, custom folders, and source versions in a file-manager style interface with archive-safe behavior.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Extension Side Panel',
    description:
      'The Chrome extension exposes status, detected subject/category, confidence, answer suggestion, explanation, and credit status in one place.',
  },
  {
    icon: WalletCards,
    title: 'Credit-Based Billing',
    description:
      'Time is stored in seconds, debited during active use, and credited only after verified payment webhook confirmation.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Client/Admin Separation',
    description:
      'Clients never see raw files, chunks, embeddings, storage paths, admin analytics, or another user\'s data.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Detection',
    description:
      'Automatically identifies active questions, extracts answer choices, and matches against the admin-curated Q&A library with high accuracy.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="bg-[#0a0a0a] py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Hero header */}
        <div className="relative mb-20 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-12 text-center lg:p-20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-b from-teal-500/[0.06] to-transparent blur-3xl" />
          </div>
          <div className="relative">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-400">
              <Zap className="h-4 w-4 text-teal-400" />
              Features
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              A Controlled AI Workflow for Study Success
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-500">
              Every major surface is designed around admin control, client-safe answers, and retrieval that stays grounded in the correct subject context.
            </p>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.title}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400 transition-colors group-hover:bg-teal-500/20">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mb-3 text-lg font-semibold text-white">{section.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-500">{section.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
