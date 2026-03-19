import { z } from 'zod';

export const catalogResponseSchema = z.object({
  subjects: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
  categories: z.array(z.object({
    id: z.string(),
    name: z.string(),
    subject_id: z.string(),
  })),
});

export const pageSignalsSchema = z.object({
  pageUrl: z.string().url(),
  pageDomain: z.string().min(1),
  pageTitle: z.string().min(1),
  headings: z.array(z.string()),
  breadcrumbs: z.array(z.string()),
  visibleLabels: z.array(z.string()),
  visibleTextExcerpt: z.string(),
  questionText: z.string().nullable(),
  options: z.array(z.string()),
  questionCandidates: z
    .array(
      z.object({
        id: z.string(),
        prompt: z.string(),
        options: z.array(z.string()),
        contextLabel: z.string().nullable(),
      }),
    )
    .default([]),
  diagnostics: z
    .object({
      explicitQuestionBlockCount: z.number().int().nonnegative().default(0),
      structuredQuestionBlockCount: z.number().int().nonnegative().default(0),
      groupedInputCount: z.number().int().nonnegative().default(0),
      promptCandidateCount: z.number().int().nonnegative().default(0),
      questionCandidateCount: z.number().int().nonnegative().default(0),
      visibleOptionCount: z.number().int().nonnegative().default(0),
      courseCodeCount: z.number().int().nonnegative().default(0),
    })
    .default({
      explicitQuestionBlockCount: 0,
      structuredQuestionBlockCount: 0,
      groupedInputCount: 0,
      promptCandidateCount: 0,
      questionCandidateCount: 0,
      visibleOptionCount: 0,
      courseCodeCount: 0,
    }),
  courseCodes: z.array(z.string()),
  quizTitle: z.string().nullable().default(null),
  quizNumber: z.string().nullable().default(null),
  totalQuestionsDetected: z.number().int().nonnegative().default(0),
  extractedAt: z.string(),
});

export const answerSuggestionSchema = z.object({
  answerText: z.string().nullable(),
  shortExplanation: z.string().nullable(),
  suggestedOption: z.string().nullable(),
  questionSuggestions: z
    .array(
      z.object({
        questionId: z.string(),
        questionText: z.string(),
        answerText: z.string().nullable(),
        suggestedOption: z.string().nullable(),
        shortExplanation: z.string().nullable(),
        confidence: z.number().min(0).max(1).nullable(),
        warning: z.string().nullable(),
        retrievalStatus: z.string(),
        matchedSubject: z.string().nullable().default(null),
        matchedCategory: z.string().nullable().default(null),
        sourceScope: z.enum(['subject_folder', 'all_subject_folders', 'file_sources', 'no_match']).default('no_match'),
        clickStatus: z.enum(['pending', 'clicked', 'suggested_only', 'no_match', 'skipped']).default('pending'),
        clickedText: z.string().nullable().default(null),
      }),
    )
    .default([]),
  subject: z.string().nullable(),
  category: z.string().nullable(),
  detectedSubject: z.string().nullable().default(null),
  detectedCategory: z.string().nullable().default(null),
  sourceSubject: z.string().nullable().default(null),
  sourceCategory: z.string().nullable().default(null),
  sourceScope: z.enum(['subject_folder', 'all_subject_folders', 'file_sources', 'no_match']).default('no_match'),
  searchScope: z.enum(['subject_first', 'all_subjects']).default('subject_first'),
  fallbackApplied: z.boolean().default(false),
  confidence: z.number().min(0).max(1).nullable(),
  warning: z.string().nullable(),
  retrievalStatus: z.string(),
});

export const extensionSessionSchema = z.object({
  sessionId: z.string().nullable(),
  status: z.enum(['session_inactive', 'session_active', 'session_paused', 'session_expired']),
  detectionMode: z.enum(['auto', 'manual']),
  liveAssistEnabled: z.boolean(),
  manualSubject: z.string(),
  manualCategory: z.string(),
  lastActivityAt: z.string().nullable(),
  cachedSubjectId: z.string().nullable().default(null),
  cachedSubjectName: z.string().nullable().default(null),
});

export const extensionNoticeSchema = z.object({
  id: z.string(),
  tone: z.enum(['info', 'success', 'warning', 'danger']),
  title: z.string(),
  message: z.string(),
  createdAt: z.string(),
});

export const extensionActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.string(),
});

const capturedSectionSchema = z.object({
  id: z.string(),
  digest: z.string(),
  pageUrl: z.string().url(),
  pageTitle: z.string(),
  questionCount: z.number().int().nonnegative(),
  capturedAt: z.string(),
  pageSignals: pageSignalsSchema,
});

export const extensionStateSchema = z.object({
  appBaseUrl: z.string(),
  pairingStatus: z.enum(['not_paired', 'paired', 'revoked']),
  uiStatus: z.enum([
    'ready',
    'not_connected',
    'no_credits',
    'scanning_page',
    'detecting_subject',
    'searching_sources',
    'suggestion_ready',
    'low_confidence',
    'no_match_found',
    'error',
  ]),
  installationId: z.string().nullable(),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  deviceName: z.string(),
  browserName: z.string(),
  extensionVersion: z.string(),
  creditsRemainingSeconds: z.number().int().nonnegative(),
  session: extensionSessionSchema,
  currentPage: pageSignalsSchema.nullable(),
  capturedSections: z.array(capturedSectionSchema).default([]),
  lastSuggestion: answerSuggestionSchema,
  notices: z.array(extensionNoticeSchema),
  recentActions: z.array(extensionActionSchema),
  lastError: z.string().nullable(),
  permissionOrigin: z.string(),
  autoClickEnabled: z.boolean().default(false),
  autoPilotEnabled: z.boolean().default(false),
});

export const pairingFormSchema = z.object({
  appBaseUrl: z.string().min(1),
  pairingCode: z.string().min(6),
  deviceName: z.string().min(2),
});

export const manualOverrideSchema = z.object({
  subject: z.string().default(''),
  category: z.string().default(''),
});

export const pairingExchangeResponseSchema = z.object({
  installationId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().nullable().default(null),
  remainingSeconds: z.number().int().nonnegative().default(0),
  sessionStatus: z
    .enum(['session_inactive', 'session_active', 'session_paused', 'session_expired'])
    .default('session_inactive'),
});

export const refreshTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().nullable().default(null),
});

export const walletResponseSchema = z.object({
  remainingSeconds: z.number().int().nonnegative(),
});

export const sessionResponseSchema = z.object({
  sessionId: z.string(),
  status: z.enum(['session_inactive', 'session_active', 'session_paused', 'session_expired']),
  remainingSeconds: z.number().int().nonnegative().optional(),
  detectionMode: z.enum(['auto', 'manual']).default('auto'),
});

export const analyzeResponseSchema = z.object({
  answerText: z.string().nullable().default(null),
  shortExplanation: z.string().nullable().default(null),
  suggestedOption: z.string().nullable().default(null),
  questionSuggestions: z
    .array(
      z.object({
        questionId: z.string(),
        questionText: z.string(),
        answerText: z.string().nullable().default(null),
        suggestedOption: z.string().nullable().default(null),
        shortExplanation: z.string().nullable().default(null),
        confidence: z.number().min(0).max(1).nullable().default(null),
        warning: z.string().nullable().default(null),
        retrievalStatus: z.string().default('Searching sources'),
        matchedSubject: z.string().nullable().default(null),
        matchedCategory: z.string().nullable().default(null),
        sourceScope: z.enum(['subject_folder', 'all_subject_folders', 'file_sources', 'no_match']).default('no_match'),
        clickStatus: z.enum(['pending', 'clicked', 'suggested_only', 'no_match', 'skipped']).default('pending'),
        clickedText: z.string().nullable().default(null),
      }),
    )
    .default([]),
  subject: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
  detectedSubject: z.string().nullable().default(null),
  detectedCategory: z.string().nullable().default(null),
  sourceSubject: z.string().nullable().default(null),
  sourceCategory: z.string().nullable().default(null),
  sourceScope: z.enum(['subject_folder', 'all_subject_folders', 'file_sources', 'no_match']).default('no_match'),
  searchScope: z.enum(['subject_first', 'all_subjects']).default('subject_first'),
  fallbackApplied: z.boolean().default(false),
  confidence: z.number().min(0).max(1).nullable().default(null),
  warning: z.string().nullable().default(null),
  retrievalStatus: z.string().default('Searching sources'),
  remainingSeconds: z.number().int().nonnegative().optional(),
});

export type ExtensionStateSchema = z.infer<typeof extensionStateSchema>;
