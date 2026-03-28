import { clamp, confidenceToLevel } from '@study-assistant/shared-utils';
import type {
  AnalyzeRequestPayload,
  AnalyzeResponsePayload,
  AnalyzeSearchScope,
  ExtensionQuestionCandidate,
  ExtensionQuestionSuggestion,
  ExtensionSourceScope,
} from '@study-assistant/shared-types';

import { buildQaPairAnswerSuggestion } from '@/lib/ai/answering';
import { isQuestionTextEquivalent, normalizeComparableText, overlapScore } from '@/lib/ai/choice-matching';
import { detectSubjectCategory } from '@/lib/ai/detection';
import { extractQuestionContext } from '@/lib/ai/extraction';
import { retrieveRelevantQaPairs, retrieveRelevantQaPairsAcrossSubjects, preloadSubjectQaPairs, type PreloadedQaPairRow } from '@/lib/ai/retrieval';
import { rankQaPairRowsLocal } from '@/lib/ai/retrieval';
import { applyWalletSeconds } from '@/lib/billing/wallet';
import { env } from '@/lib/env/server';
import { logEvent } from '@/lib/observability/logger';
import { getActiveCatalog } from '@/lib/supabase/catalog';
import { createQuestionAttempt, syncSessionAfterAnalysis } from '@/lib/supabase/sessions';
import type { CategoryRecord, SubjectRecord } from '@/lib/supabase/schemas';

const MAX_QUESTION_CANDIDATES = 5000;
const MAX_CONTEXT_ITEMS = 300;
const MAX_OPTIONS_PER_QUESTION = 50;
const BATCH_SIZE = 50;

function isBooleanQuestionOptions(options: string[]) {
  if (options.length < 2) {
    return false;
  }

  const normalizedOptions = new Set(
    options
      .map((option) => normalizeComparableText(option))
      .filter(Boolean),
  );

  return normalizedOptions.has('true') && normalizedOptions.has('false');
}

function optionAnswerSupportScore(options: string[], answerText: string) {
  if (options.length === 0) {
    return 0;
  }

  return Math.max(
    ...options.map((option) =>
      Math.max(overlapScore(option, answerText), overlapScore(answerText, option)),
    ),
  );
}

function isReliableQaPairMatch(candidate: ExtensionQuestionCandidate, pair: { question_text: string; answer_text: string }) {
  const normalizedCandidatePrompt = normalizeComparableText(candidate.prompt);
  const normalizedPairPrompt = normalizeComparableText(pair.question_text);

  if (!normalizedCandidatePrompt || !normalizedPairPrompt) {
    return false;
  }

  if (normalizedCandidatePrompt === normalizedPairPrompt) {
    return true;
  }

  if (isQuestionTextEquivalent(candidate.prompt, pair.question_text)) {
    return true;
  }

  const containmentMatch =
    normalizedCandidatePrompt.includes(normalizedPairPrompt) || normalizedPairPrompt.includes(normalizedCandidatePrompt);
  if (containmentMatch) {
    return true;
  }

  const questionOverlap = Math.max(
    overlapScore(candidate.prompt, pair.question_text),
    overlapScore(pair.question_text, candidate.prompt),
  );

  if (isBooleanQuestionOptions(candidate.options)) {
    return questionOverlap >= 0.72;
  }

  const answerSupport = optionAnswerSupportScore(candidate.options, pair.answer_text);
  
  // For dropdowns (5+ options), answerSupport is unreliable since all sub-questions share options.
  // Require stronger question overlap to prevent all sub-questions picking the same fallback answer.
  if (candidate.options.length >= 5) {
    return questionOverlap >= 0.35 || (questionOverlap >= 0.15 && answerSupport >= 0.85);
  }

  // For regular multiple choice (under 5 options), we can be a bit more lenient,
  // but we still require SOME question overlap if we rely on answerSupport.
  return questionOverlap >= 0.54 || (questionOverlap >= 0.15 && answerSupport >= 0.85);
}

function sanitizeText(value: string, limit: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function enrichShortFormPromptFromVisibleText(prompt: string, visibleTextExcerpt: string) {
  const normalizedPrompt = sanitizeText(prompt, 600);
  const normalizedVisibleText = sanitizeText(visibleTextExcerpt, 4000);
  if (!normalizedPrompt || !normalizedVisibleText || normalizedVisibleText.length <= normalizedPrompt.length + 12) {
    return normalizedPrompt;
  }

  const startIndex = normalizedVisibleText.toLowerCase().indexOf(normalizedPrompt.toLowerCase());
  if (startIndex < 0) {
    return normalizedPrompt;
  }

  const candidateWindow = normalizedVisibleText.slice(startIndex, Math.min(normalizedVisibleText.length, startIndex + 520));
  const boundaryPattern =
    /\b(?:answer:?|your answer:?|response:?|select one:?|select one or more:?|clear my choice|flag question|previous page|next page|jump to|quiz navigation|finish review|finish attempt|time left)\b/i;
  const boundaryMatch = candidateWindow.match(boundaryPattern);
  const clippedWindow =
    boundaryMatch && typeof boundaryMatch.index === 'number'
      ? candidateWindow.slice(0, boundaryMatch.index)
      : candidateWindow;
  const enrichedPrompt = sanitizeText(clippedWindow, 500);

  const containsHighSignalContext =
    /\bsalary\b/i.test(enrichedPrompt) ||
    /\bresponsibilities\b/i.test(enrichedPrompt) ||
    /[$€£₱]\s?\d/.test(enrichedPrompt) ||
    /\b\d+(?:[.,]\d+)+\b/.test(enrichedPrompt);

  if (!containsHighSignalContext || enrichedPrompt.length <= normalizedPrompt.length) {
    return normalizedPrompt;
  }

  return enrichedPrompt;
}

function sanitizeSignals(payload: AnalyzeRequestPayload['pageSignals']) {
  const visibleTextExcerpt = sanitizeText(payload.visibleTextExcerpt, 4000);
  const sanitizedQuestionCandidates = payload.questionCandidates
    .map((candidate, index) => {
      const basePrompt = sanitizeText(candidate.prompt, 600);
      const enrichedPrompt =
        candidate.options.length === 0
          ? enrichShortFormPromptFromVisibleText(basePrompt, visibleTextExcerpt)
          : basePrompt;

      return {
        id: sanitizeText(candidate.id || `question-${index + 1}`, 80) || `question-${index + 1}`,
        prompt: enrichedPrompt,
        options: candidate.options.map((option) => sanitizeText(option, 200)).filter(Boolean).slice(0, MAX_OPTIONS_PER_QUESTION),
        contextLabel: candidate.contextLabel ? sanitizeText(candidate.contextLabel, 120) : null,
      };
    })
    .filter((candidate) => candidate.prompt.length >= 12)
    .slice(0, MAX_QUESTION_CANDIDATES);

  const questionText =
    sanitizedQuestionCandidates[0]?.prompt ??
    (payload.questionText ? enrichShortFormPromptFromVisibleText(payload.questionText, visibleTextExcerpt) : null);

  return {
    ...payload,
    pageTitle: sanitizeText(payload.pageTitle, 240),
    headings: payload.headings.map((heading) => sanitizeText(heading, 180)).filter(Boolean).slice(0, MAX_CONTEXT_ITEMS),
    breadcrumbs: payload.breadcrumbs.map((crumb) => sanitizeText(crumb, 120)).filter(Boolean).slice(0, MAX_CONTEXT_ITEMS),
    visibleLabels: payload.visibleLabels.map((label) => sanitizeText(label, 120)).filter(Boolean).slice(0, 12),
    visibleTextExcerpt,
    questionText,
    options: payload.options.map((option) => sanitizeText(option, 200)).filter(Boolean).slice(0, MAX_OPTIONS_PER_QUESTION),
    questionCandidates: sanitizedQuestionCandidates,
    diagnostics: {
      explicitQuestionBlockCount: payload.diagnostics?.explicitQuestionBlockCount ?? 0,
      structuredQuestionBlockCount: payload.diagnostics?.structuredQuestionBlockCount ?? 0,
      groupedInputCount: payload.diagnostics?.groupedInputCount ?? 0,
      promptCandidateCount: payload.diagnostics?.promptCandidateCount ?? 0,
      questionCandidateCount: payload.diagnostics?.questionCandidateCount ?? payload.questionCandidates.length,
      visibleOptionCount: payload.diagnostics?.visibleOptionCount ?? payload.options.length,
      courseCodeCount: payload.diagnostics?.courseCodeCount ?? payload.courseCodes.length,
    },
    quizTitle: (payload as any).quizTitle ?? null,
    quizNumber: (payload as any).quizNumber ?? null,
    totalQuestionsDetected: (payload as any).totalQuestionsDetected ?? payload.questionCandidates.length,
  };
}

function deriveQuestionCandidates(
  pageSignals: ReturnType<typeof sanitizeSignals>,
  extracted: { questionText: string | null; options?: string[] | null },
): ExtensionQuestionCandidate[] {
  if (pageSignals.questionCandidates.length > 0) {
    return pageSignals.questionCandidates;
  }

  const fallbackPrompt = extracted.questionText ?? pageSignals.questionText;
  if (!fallbackPrompt) {
    return [];
  }

  return [
    {
      id: 'question-1',
      prompt: fallbackPrompt,
      options: (extracted.options ?? pageSignals.options).slice(0, MAX_OPTIONS_PER_QUESTION),
      contextLabel: null,
    },
  ];
}

function buildNoMatchQuestionSuggestion(params: {
  candidate: ExtensionQuestionCandidate;
  subjectName: string;
  categoryName: string | null;
  detectionConfidence: number | null;
  warning: string;
  retrievalStatus: string;
  searchScope: AnalyzeSearchScope;
}): ExtensionQuestionSuggestion {
  return {
    questionId: params.candidate.id,
    questionText: params.candidate.prompt,
    answerText: null,
    suggestedOption: null,
    shortExplanation: null,
    confidence: params.detectionConfidence,
    warning: params.warning,
    retrievalStatus: params.retrievalStatus,
    matchedSubject: params.subjectName,
    matchedCategory: params.categoryName,
    sourceScope: 'no_match',
    clickStatus: 'pending' as const,
    clickedText: null,
  } satisfies ExtensionQuestionSuggestion;
}

function resolveQuestionSuggestionFromPreloaded(params: {
  candidate: ExtensionQuestionCandidate;
  searchScope: AnalyzeSearchScope;
  subjectName: string;
  categoryName: string | null;
  detectionConfidence: number | null;
  subject: SubjectRecord;
  category: CategoryRecord | null;
  preloadedRows: PreloadedQaPairRow[];
}): ExtensionQuestionSuggestion {
  const queryText = params.candidate.prompt;
  const optionText = params.candidate.options;
  const hasOptions = optionText.length > 0;

  const buildQaSuggestion = (pair: Awaited<ReturnType<typeof retrieveRelevantQaPairs>>['pairs'][number], retrievalStatus: string, sourceScope: ExtensionSourceScope) => {
    if (!isReliableQaPairMatch(params.candidate, pair)) {
      return null;
    }

    const suggestion = buildQaPairAnswerSuggestion({
      pair,
      options: optionText,
      subjectName: pair.subject_name ?? params.subjectName,
      categoryName: pair.category_name ?? params.categoryName,
    });

    return {
      questionId: params.candidate.id,
      questionText: params.candidate.prompt,
      answerText: suggestion.answerText,
      suggestedOption: suggestion.suggestedOption,
      shortExplanation: suggestion.shortExplanation,
      confidence: clamp(
        ((params.detectionConfidence ?? 0.5) + pair.similarity + suggestion.confidence) / 3,
        0,
        1,
      ),
      warning: suggestion.warning,
      retrievalStatus,
      matchedSubject: pair.subject_name ?? params.subjectName,
      matchedCategory: pair.category_name ?? params.categoryName,
      sourceScope,
      clickStatus: 'pending' as const,
      clickedText: null,
    } satisfies ExtensionQuestionSuggestion;
  };

  // Rank the pre-loaded rows for THIS specific question locally (no DB call)
  const rankedPairs = rankQaPairRowsLocal({
    rows: params.preloadedRows,
    queryText,
    options: optionText,
    subjectNameFallback: params.subjectName,
    categoryNameFallback: params.categoryName,
  });

  const retrievalStatus = rankedPairs.length > 0
    ? `Matched ${rankedPairs.length} stored answer pair${rankedPairs.length === 1 ? '' : 's'} in ${params.subjectName}${params.category ? ` / ${params.category.name}` : ''}.`
    : `No matching subject answer pairs were found for ${params.subjectName}${params.category ? ` / ${params.category.name}` : ''}.`;

  // Check more candidates so we can skip wrong-option matches
  const topPairs = rankedPairs.slice(0, 12);
  let bestWithOption: ExtensionQuestionSuggestion | null = null;
  let bestWithoutOption: ExtensionQuestionSuggestion | null = null;

  for (const pair of topPairs) {
    const suggestion = buildQaSuggestion(pair, retrievalStatus, 'subject_folder');
    if (!suggestion) continue;

    if (suggestion.suggestedOption) {
      // This QA pair's answer maps to a real choice on the page — strong candidate
      if (!bestWithOption) bestWithOption = suggestion;
      // Exact match in the options list — use immediately
      if (optionText.includes(suggestion.suggestedOption)) {
        return suggestion;
      }
    } else if (hasOptions) {
      // Answer doesn't map to any choice — keep as fallback only
      if (!bestWithoutOption) bestWithoutOption = suggestion;
    } else {
      // No choices on the page — any answer is valid
      if (!bestWithOption) bestWithOption = suggestion;
    }
  }

  // Prefer suggestions that map to an actual choice
  if (bestWithOption) {
    return bestWithOption;
  }

  // Fallback: return the best no-option match if nothing else worked
  if (bestWithoutOption) {
    return bestWithoutOption;
  }

  return buildNoMatchQuestionSuggestion({
    candidate: params.candidate,
    subjectName: params.subjectName,
    categoryName: params.categoryName,
    detectionConfidence: params.detectionConfidence,
    warning: 'No matching source material was found in this subject folder.',
    retrievalStatus,
    searchScope: params.searchScope,
  });
}

async function buildQuestionSuggestions(params: {
  questionCandidates: ExtensionQuestionCandidate[];
  searchScope: AnalyzeSearchScope;
  subjectName: string;
  categoryName: string | null;
  detectionConfidence: number | null;
  subject: SubjectRecord;
  category: CategoryRecord | null;
}): Promise<ExtensionQuestionSuggestion[]> {
  // Pre-load ALL QA pairs for this subject in ONE database call
  const preloadedRows = await preloadSubjectQaPairs({
    subject: params.subject,
    category: params.category,
  });

  // Now resolve each question locally — no more per-question DB calls
  return params.questionCandidates.map((candidate) =>
    resolveQuestionSuggestionFromPreloaded({
      candidate,
      searchScope: params.searchScope,
      subjectName: params.subjectName,
      categoryName: params.categoryName,
      detectionConfidence: params.detectionConfidence,
      subject: params.subject,
      category: params.category,
      preloadedRows,
    }),
  );
}

function selectPrimarySuggestion(questionSuggestions: ExtensionQuestionSuggestion[]) {
  return (
    questionSuggestions.find((suggestion) => suggestion.answerText || suggestion.suggestedOption) ??
    questionSuggestions[0] ??
    null
  );
}

function isFallbackApplied(sourceScope: ExtensionSourceScope) {
  return sourceScope === 'all_subject_folders' || sourceScope === 'file_sources';
}

export async function analyzeStudyPage(params: {
  userId: string;
  sessionId: string;
  sessionSubjectId?: string | null;
  sessionCategoryId?: string | null;
  request: AnalyzeRequestPayload;
}) {
  const startedAt = Date.now();
  const pageSignals = sanitizeSignals(params.request.pageSignals);
  const searchScope = params.request.searchScope ?? 'subject_first';
  const { subjects, categories } = await getActiveCatalog();

  const detection = await detectSubjectCategory({
    subjects,
    categories,
    pageSignals,
    manualSubject: params.request.manualSubject,
    manualCategory: params.request.manualCategory,
    sessionSubjectId: params.sessionSubjectId ?? null,
    sessionCategoryId: params.sessionCategoryId ?? null,
    screenshotDataUrl: params.request.screenshotDataUrl,
  });

  if (!detection.subject) {
    const response = await persistNoMatch({
      userId: params.userId,
      sessionId: params.sessionId,
      pageSignals,
      request: params.request,
      startedAt,
      detection,
      reason: 'subject_detection_failed',
      retrievalStatus: 'No subject match found.',
      warning: detection.warning ?? 'No matching subject was found. Confirm the subject manually.',
      searchScope,
    });

    return response;
  }

  if (params.request.mode === 'detect') {
    const response: AnalyzeResponsePayload = {
      answerText: null,
      shortExplanation: detection.reasoning,
      suggestedOption: null,
      questionSuggestions: [],
      subject: detection.subject.name,
      category: detection.category?.name ?? null,
      detectedSubject: detection.subject.name,
      detectedCategory: detection.category?.name ?? null,
      sourceSubject: null,
      sourceCategory: null,
      sourceScope: 'no_match',
      searchScope,
      fallbackApplied: false,
      confidence: detection.subjectConfidence,
      warning: detection.warning,
      retrievalStatus: 'Detection only.',
    };

    await Promise.all([
      createQuestionAttempt({
        sessionId: params.sessionId,
        userId: params.userId,
        pageUrl: pageSignals.pageUrl,
        pageTitle: pageSignals.pageTitle,
        extractedQuestionText: pageSignals.questionText,
        extractedOptions: pageSignals.options,
        selectedSubjectId: params.request.manualSubject ? detection.subject.id : null,
        detectedSubjectId: detection.subject.id,
        selectedCategoryId: params.request.manualCategory ? detection.category?.id ?? null : null,
        detectedCategoryId: detection.category?.id ?? null,
        detectionConfidence: detection.subjectConfidence,
        retrievalConfidence: null,
        finalConfidence: detection.subjectConfidence,
        answerText: null,
        shortExplanation: detection.reasoning,
        answerSchema: response as unknown as Record<string, unknown>,
        noMatchReason: null,
        processingMs: Date.now() - startedAt,
        modelUsed: env.OPENAI_SUBJECT_MODEL,
      }),
      syncSessionAfterAnalysis({
        sessionId: params.sessionId,
        userId: params.userId,
        subjectId: detection.subject.id,
        categoryId: detection.category?.id ?? null,
        detectionMode: detection.detectionMode,
        usedSecondsDelta: 0,
        pageUrl: pageSignals.pageUrl,
        pageDomain: pageSignals.pageDomain,
        pageTitle: pageSignals.pageTitle,
      }),
    ]);

    return response;
  }

  const extracted = await extractQuestionContext({
    pageSignals,
    screenshotDataUrl: params.request.screenshotDataUrl,
  });

  if (!extracted.questionText) {
    return persistNoMatch({
      userId: params.userId,
      sessionId: params.sessionId,
      pageSignals,
      request: params.request,
      startedAt,
      detection,
      reason: 'question_extraction_failed',
      retrievalStatus: 'Question extraction did not find a usable prompt.',
      warning: 'No clear question was detected on the page. Confirm the subject or analyze after the question is visible.',
      extractedQuestionText: null,
      extractedOptions: extracted.options ?? null,
      searchScope,
    });
  }

  const questionCandidates = deriveQuestionCandidates(pageSignals, extracted);
  const questionSuggestions = await buildQuestionSuggestions({
    questionCandidates,
    searchScope,
    subjectName: detection.subject.name,
    categoryName: detection.category?.name ?? null,
    detectionConfidence: detection.subjectConfidence,
    subject: detection.subject,
    category: detection.category,
  });

  const primarySuggestion = selectPrimarySuggestion(questionSuggestions);
  if (!primarySuggestion || (!primarySuggestion.answerText && !primarySuggestion.suggestedOption)) {
    return persistNoMatch({
      userId: params.userId,
      sessionId: params.sessionId,
      pageSignals,
      request: params.request,
      startedAt,
      detection,
      reason: 'retrieval_no_match',
      retrievalStatus: primarySuggestion?.retrievalStatus ?? 'No matching answer pair or file-based source was found.',
      warning:
        primarySuggestion?.warning ??
        'No matching source material was found. Retry with all subject folders or confirm the subject manually.',
      extractedQuestionText: extracted.questionText,
      extractedOptions: extracted.options ?? null,
      retrievalConfidence: primarySuggestion?.confidence ?? null,
      questionSuggestions,
      searchScope,
    });
  }

  const finalConfidence = clamp(
    ((detection.subjectConfidence ?? 0.5) + (primarySuggestion.confidence ?? 0.5)) / 2,
    0,
    1,
  );

  const walletResult = await applyWalletSeconds({
    userId: params.userId,
    deltaSeconds: -env.ANALYSIS_DEBIT_SECONDS,
    transactionType: 'usage_debit',
    description: `AI page analysis for ${detection.subject.name}${detection.category ? ` / ${detection.category.name}` : ''}`,
    relatedSessionId: params.sessionId,
    metadata: {
      mode: params.request.mode,
      candidateCount: questionSuggestions.length,
      searchScope,
      sourceScope: primarySuggestion.sourceScope,
      confidence: finalConfidence,
    },
  });

  const response: AnalyzeResponsePayload = {
    answerText: primarySuggestion.answerText,
    shortExplanation: primarySuggestion.shortExplanation,
    suggestedOption: primarySuggestion.suggestedOption,
    questionSuggestions,
    subject: detection.subject.name,
    category: detection.category?.name ?? null,
    detectedSubject: detection.subject.name,
    detectedCategory: detection.category?.name ?? null,
    sourceSubject: primarySuggestion.matchedSubject ?? detection.subject.name,
    sourceCategory: primarySuggestion.matchedCategory ?? detection.category?.name ?? null,
    sourceScope: primarySuggestion.sourceScope,
    searchScope,
    fallbackApplied: isFallbackApplied(primarySuggestion.sourceScope),
    confidence: finalConfidence,
    warning:
      detection.warning ??
      primarySuggestion.warning ??
      (confidenceToLevel(finalConfidence) === 'low' ? 'Confidence is low. Confirm the subject manually if needed.' : null),
    retrievalStatus: primarySuggestion.retrievalStatus,
    remainingSeconds: walletResult.remaining_seconds,
  };

  await Promise.all([
    createQuestionAttempt({
      sessionId: params.sessionId,
      userId: params.userId,
      pageUrl: pageSignals.pageUrl,
      pageTitle: pageSignals.pageTitle,
      extractedQuestionText: extracted.questionText,
      extractedOptions: extracted.options ?? null,
      selectedSubjectId: params.request.manualSubject ? detection.subject.id : null,
      detectedSubjectId: detection.subject.id,
      selectedCategoryId: params.request.manualCategory ? detection.category?.id ?? null : null,
      detectedCategoryId: detection.category?.id ?? null,
      detectionConfidence: detection.subjectConfidence,
      retrievalConfidence: primarySuggestion.confidence,
      finalConfidence,
      answerText: response.answerText,
      shortExplanation: response.shortExplanation,
      answerSchema: response as unknown as Record<string, unknown>,
      noMatchReason: null,
      processingMs: Date.now() - startedAt,
      modelUsed: env.OPENAI_ANSWER_MODEL,
    }),
    syncSessionAfterAnalysis({
      sessionId: params.sessionId,
      userId: params.userId,
      subjectId: detection.subject.id,
      categoryId: detection.category?.id ?? null,
      detectionMode: detection.detectionMode,
      usedSecondsDelta: env.ANALYSIS_DEBIT_SECONDS,
      pageUrl: pageSignals.pageUrl,
      pageDomain: pageSignals.pageDomain,
      pageTitle: pageSignals.pageTitle,
    }),
  ]);

  logEvent('info', 'ai.analysis.completed', {
    userId: params.userId,
    sessionId: params.sessionId,
    subjectId: detection.subject.id,
    categoryId: detection.category?.id ?? null,
    confidence: finalConfidence,
    candidateCount: questionSuggestions.length,
    sourceScope: primarySuggestion.sourceScope,
    sourceSubject: primarySuggestion.matchedSubject ?? detection.subject.name,
    processingMs: Date.now() - startedAt,
  });

  return response;
}

async function persistNoMatch(params: {
  userId: string;
  sessionId: string;
  pageSignals: AnalyzeRequestPayload['pageSignals'];
  request: AnalyzeRequestPayload;
  startedAt: number;
  detection: Awaited<ReturnType<typeof detectSubjectCategory>>;
  reason: string;
  retrievalStatus: string;
  warning: string;
  searchScope: AnalyzeSearchScope;
  extractedQuestionText?: string | null;
  extractedOptions?: string[] | null;
  retrievalConfidence?: number | null;
  questionSuggestions?: ExtensionQuestionSuggestion[];
}) {
  const fallbackQuestionSuggestions =
    params.questionSuggestions ??
    params.pageSignals.questionCandidates.slice(0, MAX_QUESTION_CANDIDATES).map((candidate) => ({
      questionId: candidate.id,
      questionText: candidate.prompt,
      answerText: null,
      suggestedOption: null,
      shortExplanation: null,
      confidence: params.detection.subjectConfidence,
      warning: params.warning,
      retrievalStatus: params.retrievalStatus,
      matchedSubject: params.detection.subject?.name ?? null,
      matchedCategory: params.detection.category?.name ?? null,
      sourceScope: 'no_match' as const,
      clickStatus: 'pending' as const,
      clickedText: null,
    }));

  const response: AnalyzeResponsePayload = {
    answerText: null,
    shortExplanation: null,
    suggestedOption: null,
    questionSuggestions: fallbackQuestionSuggestions,
    subject: params.detection.subject?.name ?? null,
    category: params.detection.category?.name ?? null,
    detectedSubject: params.detection.subject?.name ?? null,
    detectedCategory: params.detection.category?.name ?? null,
    sourceSubject: null,
    sourceCategory: null,
    sourceScope: 'no_match',
    searchScope: params.searchScope,
    fallbackApplied: false,
    confidence: params.detection.subjectConfidence,
    warning: params.warning,
    retrievalStatus: params.retrievalStatus,
  };

  await Promise.all([
    createQuestionAttempt({
      sessionId: params.sessionId,
      userId: params.userId,
      pageUrl: params.pageSignals.pageUrl,
      pageTitle: params.pageSignals.pageTitle,
      extractedQuestionText: params.extractedQuestionText ?? params.pageSignals.questionText,
      extractedOptions: params.extractedOptions ?? params.pageSignals.options,
      selectedSubjectId: params.request.manualSubject ? params.detection.subject?.id ?? null : null,
      detectedSubjectId: params.detection.subject?.id ?? null,
      selectedCategoryId: params.request.manualCategory ? params.detection.category?.id ?? null : null,
      detectedCategoryId: params.detection.category?.id ?? null,
      detectionConfidence: params.detection.subjectConfidence,
      retrievalConfidence: params.retrievalConfidence ?? null,
      finalConfidence: params.detection.subjectConfidence,
      answerText: null,
      shortExplanation: null,
      answerSchema: response as unknown as Record<string, unknown>,
      noMatchReason: params.reason,
      processingMs: Date.now() - params.startedAt,
      modelUsed: env.OPENAI_ANSWER_MODEL,
    }),
    syncSessionAfterAnalysis({
      sessionId: params.sessionId,
      userId: params.userId,
      subjectId: params.detection.subject?.id ?? null,
      categoryId: params.detection.category?.id ?? null,
      detectionMode: params.detection.detectionMode,
      usedSecondsDelta: env.NO_MATCH_ANALYSIS_DEBIT_SECONDS,
      pageUrl: params.pageSignals.pageUrl,
      pageDomain: params.pageSignals.pageDomain,
      pageTitle: params.pageSignals.pageTitle,
    }),
  ]);

  return response;
}
