import { Mail, MessageSquareText, ShieldEllipsis } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

import { ContactForm } from '@/features/public/contact-form';

export default function ContactPage() {
  return (
    <div className="page-shell grid gap-8 py-12 lg:grid-cols-[0.88fr_1.12fr]">
      <div className="space-y-6">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.18em] text-accent">Support</p>
          <h1 className="font-display text-5xl font-semibold tracking-tight">
            Talk to the team behind the admin-managed study workflow.
          </h1>
          <p className="text-lg text-muted-foreground">
            Use this channel for onboarding, support escalation, and architecture questions around billing, source
            ingestion, and extension rollout.
          </p>
        </div>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <Mail className="h-5 w-5 text-accent" />
              <CardTitle>Email support</CardTitle>
              <CardDescription>support@studyassistant.example</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <MessageSquareText className="h-5 w-5 text-accent" />
              <CardTitle>Implementation reviews</CardTitle>
              <CardDescription>Source library setup, extension rollout, and billing configuration guidance.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <ShieldEllipsis className="h-5 w-5 text-accent" />
              <CardTitle>Security requests</CardTitle>
              <CardDescription>Ask about private storage, source controls, audit logging, and access boundaries.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
      <ContactForm />
    </div>
  );
}
