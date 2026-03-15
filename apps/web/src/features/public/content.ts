export const heroHighlights = [
  'Subject-aware retrieval restricted to admin-approved course material',
  'Secure Chrome extension that analyzes the current tab only after user action',
  'Client-safe answers with explanation and confidence, without raw source leakage',
];

export const featureCards = [
  {
    title: 'Subject-aware routing',
    description:
      'The system routes each question into the correct subject and category using URL rules, keywords, visible page signals, and model-assisted confirmation.',
  },
  {
    title: 'Admin-managed source library',
    description:
      'Only admins manage folders, files, versions, and categories. Clients never browse raw material, embeddings, or storage URLs.',
  },
  {
    title: 'Credit-based access',
    description:
      'Usage is tracked in wallet seconds with webhook-verified top-ups, idle protection, and consistent ledger accounting.',
  },
  {
    title: 'Extension side panel workflow',
    description:
      'Learners can analyze the active tab, inspect confidence, switch subject/course manually, and copy suggestion-only output.',
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
