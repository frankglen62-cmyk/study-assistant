import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

export const metadata: Metadata = {
  title: 'Privacy Policy — Admin-Managed AI Study Assistant',
  description: 'How we handle your data, protect your privacy, and manage private study sources.',
};

const sections = [
  {
    title: 'Information We Collect',
    content:
      'We collect account information you provide during registration (name, email), usage data from study sessions (timestamps, durations, subject/category associations), and payment transaction records. We do not collect browsing history, keystrokes, or data from websites you visit outside of explicit "Analyze" actions.',
  },
  {
    title: 'How We Use Your Information',
    content:
      'Your information is used to provide and improve study assistance, manage credit-based billing, detect and match relevant study subjects, and maintain platform security. We do not sell personal data to third parties. Aggregated, anonymized usage statistics may be used internally to improve subject coverage and system reliability.',
  },
  {
    title: 'Private Source Material',
    content:
      'All study source material is uploaded and managed exclusively by authorized administrators. Source files are stored in private, access-controlled storage buckets. Raw source content, chunks, and embeddings are never exposed to client users. Clients receive only suggestion-based answers, short explanations, and confidence scores.',
  },
  {
    title: 'Chrome Extension Data Handling',
    content:
      'The Chrome extension transmits page content only when you explicitly click "Analyze Current Page" or enable "Live Assist" mode. The extension does not passively monitor tabs, collect browsing history, or transmit data without your action. Extension pairing uses short-lived cryptographic tokens and does not rely on shared browser cookies.',
  },
  {
    title: 'Payment and Billing',
    content:
      'Payment processing is handled by Stripe. We do not store credit card numbers or sensitive payment credentials on our servers. We retain transaction records (amounts, timestamps, statuses) for billing history and dispute resolution.',
  },
  {
    title: 'Data Retention',
    content:
      'Account data is retained for the duration of your active account. Session logs and question attempts are retained for operational and quality assurance purposes. You may request deletion of your account and associated data by contacting support.',
  },
  {
    title: 'Data Security',
    content:
      'We use industry-standard security practices including encrypted transport (HTTPS/TLS), row-level security policies on database records, service-role separation for admin and client access, and cryptographic token verification for extension authentication.',
  },
  {
    title: 'Changes to This Policy',
    content:
      'We may update this Privacy Policy as the platform evolves. Material changes will be communicated through the application. Continued use of the service after changes constitutes acceptance of the updated policy.',
  },
  {
    title: 'Contact',
    content:
      'For privacy-related questions or data requests, please contact us through the Support page or email the platform administrator directly.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="page-shell space-y-10 py-12">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.18em] text-accent">Legal</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="max-w-2xl text-muted-foreground">
          This policy describes how we collect, use, and protect your information when you use the
          Admin-Managed AI Study Assistant platform and Chrome extension.
        </p>
      </div>
      <div className="grid gap-6">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">{section.content}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
