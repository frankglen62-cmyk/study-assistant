import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

export const metadata: Metadata = {
  title: 'Terms of Service — Admin-Managed AI Study Assistant',
  description: 'Terms governing the use of the AI Study Assistant platform, extension, and credit-based billing.',
};

const sections = [
  {
    title: 'Acceptance of Terms',
    content:
      'By creating an account or using the platform, you agree to these Terms of Service. If you do not agree, do not use the service. Administrators who upload source material on behalf of an organization are additionally bound by any agreements between the organization and the platform operator.',
  },
  {
    title: 'Account Responsibilities',
    content:
      'You are responsible for maintaining the security of your account credentials. You must not share your account, pairing codes, or extension tokens with unauthorized individuals. You must provide accurate registration information and promptly update it if it changes. The platform operator reserves the right to suspend accounts that violate these terms.',
  },
  {
    title: 'Acceptable Use',
    content:
      'The platform is designed for legitimate study assistance. You may not use the platform to violate academic integrity policies, distribute copyrighted content, reverse-engineer the retrieval system, attempt to extract raw source material, or abuse the analyze feature through automated scripting or excessive request volume.',
  },
  {
    title: 'Credit-Based Billing',
    content:
      'Access to study assistance features requires purchased credits. Credits are consumed during active sessions and analysis requests. Credit packages are non-refundable unless required by applicable law. The platform operator may adjust pricing, package offerings, and credit debit rates with reasonable notice.',
  },
  {
    title: 'Extension Behavior',
    content:
      'The Chrome extension analyzes the active tab only when you explicitly request it. The extension does not modify page content, auto-submit answers, or interact with third-party websites on your behalf. Suggested answers are informational only. You are responsible for how you use any information provided by the platform.',
  },
  {
    title: 'Private Source Material',
    content:
      'Study source material is provided by authorized administrators. The platform does not guarantee the accuracy, completeness, or recency of source material. Source files remain private to the administrative organization and are not shared across accounts or organizations.',
  },
  {
    title: 'Limitation of Liability',
    content:
      'The platform is provided "as is" without warranties of any kind. The platform operator is not liable for academic outcomes, lost credits due to technical issues, or damages arising from platform use. Maximum liability is limited to the amount paid for credits in the preceding 90 days.',
  },
  {
    title: 'Service Availability',
    content:
      'We aim for high availability but do not guarantee uninterrupted service. Scheduled maintenance, infrastructure issues, or third-party service disruptions may cause temporary unavailability. In the event of extended outages affecting paid usage, credit adjustments may be made at the operator\'s discretion.',
  },
  {
    title: 'Termination',
    content:
      'You may close your account at any time. The platform operator may suspend or terminate accounts that violate these terms, engage in abusive behavior, or pose security risks. Upon termination, access to the platform and remaining credits is revoked.',
  },
  {
    title: 'Governing Law',
    content:
      'These terms are governed by the laws of the jurisdiction in which the platform operator is incorporated. Disputes will be resolved through binding arbitration or the courts of that jurisdiction.',
  },
  {
    title: 'Changes to Terms',
    content:
      'We may update these Terms of Service as the platform evolves. Material changes will be communicated through the application. Continued use after changes constitutes acceptance.',
  },
];

export default function TermsPage() {
  return (
    <div className="page-shell space-y-10 py-12">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.18em] text-accent">Legal</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="max-w-2xl text-muted-foreground">
          These terms govern your use of the Admin-Managed AI Study Assistant platform, Chrome extension,
          and credit-based billing system.
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
