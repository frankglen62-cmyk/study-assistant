export const heroHighlights = [
  'Subject-aware retrieval restricted to admin-approved course material',
  'Secure Chrome extension that analyzes the current tab only after user action',
  'Client-safe answers with explanation and confidence, without raw source leakage',
];

export const featureCards = [
  {
    title: 'Subject-Guided Review',
    description:
      'Stay focused on the right course with a cleaner review flow that keeps each session aligned to the subject you are working on.',
    icon: 'BrainCircuit' as const,
  },
  {
    title: 'Private Study Library',
    description:
      'Course material stays organized in one private library so learners always review from a consistent, controlled study workspace.',
    icon: 'FolderTree' as const,
  },
  {
    title: 'Flexible Session Access',
    description:
      'Start when you need it, pause when you do not, and keep your study time easy to manage from the portal.',
    icon: 'WalletCards' as const,
  },
  {
    title: 'Focused Side Panel',
    description:
      'Open a compact side panel built for quick review, fast switching, and a cleaner study experience inside the browser.',
    icon: 'MonitorSmartphone' as const,
  },
  {
    title: 'Smart Subject Matching',
    description:
      'The workspace helps match the current page to the right subject so results stay more relevant and easier to review.',
    icon: 'Sparkles' as const,
  },
  {
    title: 'Private by Design',
    description:
      'Built around admin control, client-safe outputs, and a cleaner privacy boundary for every study session.',
    icon: 'ShieldCheck' as const,
  },
];

export const howItWorks = [
  {
    step: '01',
    title: 'Set up your study workspace',
    description:
      'Open the portal, connect the browser once, and keep your study tools ready in a single place.',
  },
  {
    step: '02',
    title: 'Pick the right subject',
    description:
      'Choose a subject manually or let the workspace guide detection from the page you are reviewing.',
  },
  {
    step: '03',
    title: 'Review suggestions in the side panel',
    description:
      'Use the browser panel to keep actions, subject context, and study results in one cleaner view.',
  },
  {
    step: '04',
    title: 'Keep sessions organized',
    description:
      'Move from page to page with a simpler workflow designed for repeatable, subject-based review.',
  },
];

/**
 * Testimonials shown on the public homepage.
 *
 * Add real, attributed quotes here once they are collected. The Testimonials
 * section is hidden on the homepage when this list is empty so we never ship
 * fabricated reviews to production.
 */
export interface Testimonial {
  rating: number;
  quote: string;
  name: string;
  role: string;
}

export const testimonials: Testimonial[] = [];

export const faqItems = [
  {
    question: 'Can clients read the uploaded study files?',
    answer:
      'No. Clients receive answer suggestions and explanations only. Raw files, chunk text, embeddings, storage paths, and source URLs stay server-side.',
  },
  {
    question: 'Does the extension monitor every tab automatically?',
    answer:
      'No. It analyzes the current tab only after the user clicks Analyze or explicitly enables Live Assist. There is no silent broad monitoring.',
  },
  {
    question: 'How are credits charged?',
    answer:
      'Packages credit study time instantly after verified payment. We track usage precisely in the background so idle sessions can pause cleanly and billing stays accurate.',
  },
  {
    question: 'Do credits expire?',
    answer:
      'Each package shows its own expiry on the pricing page. Most public packages keep credits available indefinitely; any time-limited package is labeled clearly before checkout.',
  },
  {
    question: 'Which browsers does the extension support?',
    answer:
      'The extension targets Chromium-based desktop browsers (Chrome, Edge, Brave) using Manifest V3 and the side panel API. Firefox and Safari are not supported today.',
  },
  {
    question: 'How is two-factor authentication handled?',
    answer:
      'Authenticator-app MFA is optional for both portal and admin accounts. You can enable, change, or remove it from the Account page in the portal at any time.',
  },
  {
    question: 'Can admins control subject routing rules?',
    answer:
      'Yes. Admins manage subject keywords, category keywords, course codes, and URL patterns to improve routing accuracy.',
  },
  {
    question: 'Can I get a refund or transfer credits?',
    answer:
      'Reach out to support before using a package and we will review refund or transfer requests case by case. Used study time is not refundable, but unused balances usually are.',
  },
];
