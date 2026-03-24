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
    description: 'Open the portal, connect the browser once, and keep your study tools ready in a single place.',
  },
  {
    step: '02',
    title: 'Pick the right subject',
    description: 'Choose a subject manually or let the workspace guide detection from the page you are reviewing.',
  },
  {
    step: '03',
    title: 'Review suggestions in the side panel',
    description: 'Use the browser panel to keep actions, subject context, and study results in one cleaner view.',
  },
  {
    step: '04',
    title: 'Keep sessions organized',
    description: 'Move from page to page with a simpler workflow designed for repeatable, subject-based review.',
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
