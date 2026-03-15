import { BrainCircuit, FolderTree, Layers3, ShieldCheck, WalletCards } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

const sections = [
  {
    icon: BrainCircuit,
    title: 'Subject-aware retrieval',
    description:
      'Answers are routed by manual override, URL rules, course code hints, keywords, and model-assisted classification before retrieval begins.',
  },
  {
    icon: FolderTree,
    title: 'Admin-managed private source library',
    description:
      'Admins organize subject roots, categories, custom folders, and source versions in a file-manager style interface with archive-safe behavior.',
  },
  {
    icon: Layers3,
    title: 'Extension side panel',
    description:
      'The Chrome extension exposes status, detected subject/category, confidence, answer suggestion, explanation, and credit status in one place.',
  },
  {
    icon: WalletCards,
    title: 'Credit-based billing',
    description:
      'Time is stored in seconds, debited during active use, and credited only after verified payment webhook confirmation.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure client/admin separation',
    description:
      'Clients never see raw files, chunks, embeddings, storage paths, admin analytics, or another user’s data.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="page-shell space-y-10 py-12">
      <div className="max-w-3xl space-y-4">
        <p className="text-sm uppercase tracking-[0.18em] text-accent">Features</p>
        <h1 className="font-display text-5xl font-semibold tracking-tight">
          A controlled AI workflow for schools, academies, and training teams.
        </h1>
        <p className="text-lg text-muted-foreground">
          Every major surface is designed around admin control, client-safe answers, and retrieval that stays grounded in
          the correct subject context.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Card key={section.title} className="rounded-[32px]">
              <CardHeader>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
