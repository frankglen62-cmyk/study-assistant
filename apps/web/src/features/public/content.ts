export const heroHighlights = [
  'Subject-aware retrieval restricted to admin-approved course material',
  'Secure Chrome extension that analyzes the current tab only after user action',
  'Client-safe answers with explanation and confidence, without raw source leakage',
];

export const featureCards = [
  {
    title: 'Subject-Aware Routing',
    description:
      'The system routes each question into the correct subject and category using URL rules, keywords, visible page signals, and model-assisted confirmation.',
    icon: 'BrainCircuit' as const,
  },
  {
    title: 'Admin-Managed Source Library',
    description:
      'Only admins manage folders, files, versions, and categories. Clients never browse raw material, embeddings, or storage URLs.',
    icon: 'FolderTree' as const,
  },
  {
    title: 'Credit-Based Access',
    description:
      'Usage is tracked in wallet seconds with webhook-verified top-ups, idle protection, and consistent ledger accounting.',
    icon: 'WalletCards' as const,
  },
  {
    title: 'Extension Side Panel',
    description:
      'Learners can analyze the active tab, inspect confidence, switch subject/course manually, and copy suggestion-only output.',
    icon: 'MonitorSmartphone' as const,
  },
  {
    title: 'AI-Powered Detection',
    description:
      'Automatically identifies active questions, extracts answer choices, and matches against the admin-curated Q&A library with high accuracy.',
    icon: 'Sparkles' as const,
  },
  {
    title: 'Secure by Design',
    description:
      'Private sources remain server-side. No raw file leakage, no auto-submit behavior, and no silent tab monitoring.',
    icon: 'ShieldCheck' as const,
  },
];

export const howItWorks = [
  {
    step: '01',
    title: 'Admins curate private sources',
    description: 'Subjects, categories, folders, and source files are organized once and re-used across every learner session.',
  },
  {
    step: '02',
    title: 'Clients buy time credits and pair the extension',
    description: 'The wallet tracks remaining seconds, paired devices, and session activity from the client portal.',
  },
  {
    step: '03',
    title: 'The extension analyzes only on request',
    description: 'Page signals are extracted from the active tab after user action or explicitly enabled Live Assist.',
  },
  {
    step: '04',
    title: 'The backend returns a grounded suggestion',
    description: 'Retrieval stays server-side and returns only concise answers, explanations, and confidence.',
  },
];

export const pricingTeaser = [
  { name: '1 hour', amount: '$9', detail: 'Ideal for occasional review sessions' },
  { name: '3 hours', amount: '$24', detail: 'Best for weekly quiz prep' },
  { name: '5 hours', amount: '$36', detail: 'For active semester support' },
];

export const testimonials = [
  {
    rating: 4.9,
    quote: 'Study Assistant has completely changed how I prepare for exams. The AI suggestions are incredibly accurate and save me hours of review time.',
    name: 'Maria Santos',
    role: 'IT Student, Dean\'s Lister',
  },
  {
    rating: 4.8,
    quote: 'The subject detection is amazing. It automatically knows which course I\'m working on and pulls the right answers from the library.',
    name: 'James Rodriguez',
    role: 'Computer Science Student',
  },
  {
    rating: 4.9,
    quote: 'As someone juggling multiple subjects, the extension side panel is a lifesaver. Quick, accurate, and always grounded in the right source material.',
    name: 'Angela Cruz',
    role: 'Engineering Student',
  },
  {
    rating: 4.7,
    quote: 'The credit-based system is fair — I only pay for what I use. No subscriptions, no hidden fees. Perfect for students on a budget.',
    name: 'Daniel Kim',
    role: 'Information Technology Student',
  },
  {
    rating: 4.8,
    quote: 'I love that the answers come with confidence scores and explanations. It helps me understand the material, not just get the answer.',
    name: 'Sofia Reyes',
    role: 'Education Student',
  },
  {
    rating: 4.9,
    quote: 'The admin portal makes it easy to manage hundreds of Q&A pairs across multiple subjects. Importing new courses takes seconds.',
    name: 'Prof. Mark Torres',
    role: 'Course Administrator',
  },
];

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
      'Credits are stored in seconds and deducted during active use. Idle sessions auto-pause, and payments only provision credits after verified webhooks.',
  },
  {
    question: 'Can admins control subject routing rules?',
    answer:
      'Yes. Admins manage subject keywords, category keywords, course codes, and URL patterns to improve routing accuracy.',
  },
];
