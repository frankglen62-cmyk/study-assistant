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
import { isQuestionTextEquivalent, normalizeComparableText, overlapScore, splitMultiAnswerSegments, splitMultiAnswerByChoices } from '@/lib/ai/choice-matching';
import { detectSubjectCategory } from '@/lib/ai/detection';
import { extractQuestionContext } from '@/lib/ai/extraction';
import { retrieveRelevantQaPairs, retrieveRelevantQaPairsAcrossSubjects, preloadSubjectQaPairs, type PreloadedQaPairRow } from '@/lib/ai/retrieval';
import { rankQaPairRowsLocal } from '@/lib/ai/retrieval';
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

  // For very short prompts (≤10 chars, e.g. "what", "who", "when"), if the
  // stored question is also very short and they match exactly after normalization,
  // accept it directly. This handles dropdown sub-questions.
  if (normalizedCandidatePrompt.length <= 10 && normalizedPairPrompt.length <= 10) {
    // Short text exact match already handled above. For near-matches, require very
    // high overlap to avoid false positives between "who" and "how" etc.
    const shortOverlap = Math.max(
      overlapScore(candidate.prompt, pair.question_text),
      overlapScore(pair.question_text, candidate.prompt),
    );
    return shortOverlap >= 0.9;
  }

  // Containment match — but guard against short Q&A texts falsely matching long prompts.
  // The shorter text must be at least 40% the length of the longer one.
  const shorterLen = Math.min(normalizedCandidatePrompt.length, normalizedPairPrompt.length);
  const longerLen = Math.max(normalizedCandidatePrompt.length, normalizedPairPrompt.length);
  const containmentMatch =
    normalizedCandidatePrompt.includes(normalizedPairPrompt) || normalizedPairPrompt.includes(normalizedCandidatePrompt);
  if (containmentMatch && (shorterLen >= longerLen * 0.4 || shorterLen >= 60)) {
    return true;
  }

  const questionOverlap = Math.max(
    overlapScore(candidate.prompt, pair.question_text),
    overlapScore(pair.question_text, candidate.prompt),
  );

  if (isBooleanQuestionOptions(candidate.options)) {
    return questionOverlap >= 0.72;
  }

  // For dropdowns (5+ options), answerSupport is COMPLETELY UNRELIABLE because all
  // sub-questions share the same set of dropdown options. The answer of one Q&A pair
  // will always be present in the shared options, causing every sub-question to match
  // the same pair. Rely ONLY on question text overlap with a high threshold.
  if (candidate.options.length >= 5) {
    return questionOverlap >= 0.55;
  }

  // For regular multiple choice (under 5 options), we can use answerSupport as a
  // secondary signal since each question has its own distinct options.
  const answerSupport = optionAnswerSupportScore(candidate.options, pair.answer_text);
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
      questionType: candidate.questionType ?? null,
      };
    })
    // Allow short prompts (e.g. "what", "who", "when") when they have dropdown options (2+)
    .filter((candidate) => candidate.prompt.length >= 12 || (candidate.prompt.length >= 1 && candidate.options.length >= 2))
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
    questionType: null,
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
    questionType: null,
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
  globalOptions: string[];
}): ExtensionQuestionSuggestion {
  const queryText = params.candidate.prompt;
  const optionText = params.candidate.options.length > 0 ? params.candidate.options : params.globalOptions;
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
      questionType: params.candidate.questionType ?? (pair).question_type ?? null,
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
      questionType: (pair).question_type ?? null,
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

  // ── Explicit choice-aware disambiguation for duplicate questions ──────
  // When the same question text appears multiple times in the database with
  // different answers, we MUST pick the answer that matches a visible choice
  // on the current page. This is the definitive disambiguation mechanism.
  //
  // GLOBAL FIX: This works for ALL subjects — any duplicate question with
  // different answers will be resolved by matching against visible choices.
  const topPairs = rankedPairs.slice(0, 12);

  // Helper: score how well an answer text matches the visible choices (0–1).
  // 1.0 = exact match to a choice, 0.92 = near-exact, 0.3–0.6 = token overlap, 0 = no match.
  // For MULTI-ANSWER Q&A pairs (checkboxes), each answer segment is scored individually.
  function scoreAnswerChoiceAlignment(answerText: string): number {
    if (!hasOptions) return 0;
    const normAnswer = normalizeComparableText(answerText);
    if (!normAnswer) return 0;
    const normOpts = optionText
      .map((o) => normalizeComparableText(o))
      .filter(Boolean);

    // Tier 1: Exact match → 1.0
    if (normOpts.some((no) => no === normAnswer)) return 1.0;

    // Tier 2: Near-exact containment (high length ratio) → 0.92
    for (const no of normOpts) {
      const shorter = Math.min(no.length, normAnswer.length);
      const longer = Math.max(no.length, normAnswer.length);
      if (
        shorter > 0 &&
        longer > 0 &&
        shorter / longer >= 0.75 &&
        (no.includes(normAnswer) || normAnswer.includes(no))
      ) {
        return 0.92;
      }
    }

    // ── Multi-answer handling (checkbox questions) ──────────────────────
    // When the answer is "Grid Computing, Utility Computing, Cloud Computing,
    // Software as a Service", split into segments and check each against choices.
    const multiSegments = splitMultiAnswerSegments(answerText);
    if (multiSegments.length >= 2) {
      let segmentMatches = 0;
      for (const segment of multiSegments) {
        const normSegment = normalizeComparableText(segment);
        if (!normSegment) continue;
        // Check if this segment matches any visible choice
        const segmentHit = normOpts.some((no) => {
          if (no === normSegment) return true;
          const shorter = Math.min(no.length, normSegment.length);
          const longer = Math.max(no.length, normSegment.length);
          if (shorter > 0 && longer > 0 && shorter / longer >= 0.75 &&
            (no.includes(normSegment) || normSegment.includes(no))) return true;
          // Token overlap for fuzzy segment match
          const fwd = overlapScore(normSegment, no);
          const bwd = overlapScore(no, normSegment);
          return Math.min(fwd, bwd) >= 0.75;
        });
        if (segmentHit) segmentMatches++;
      }
      if (segmentMatches >= 2) {
        // Score proportional to how many segments matched choices
        // 4/4 = 0.96, 3/4 = 0.82, 2/4 = 0.68
        return 0.50 + (segmentMatches / multiSegments.length) * 0.46;
      }
    }

    // Fallback: concatenated answers without commas
    // Check how many visible choices appear within the answer text
    const choicesBySubstring = splitMultiAnswerByChoices(answerText, optionText);
    if (choicesBySubstring.length >= 2) {
      return 0.50 + (choicesBySubstring.length / Math.max(choicesBySubstring.length, 4)) * 0.46;
    }

    // Tier 3: Token overlap — gives intermediate scores (0.3–0.6) so the sort
    // can distinguish between a partially-matching answer and a non-matching one.
    const bestOverlap = Math.max(
      ...normOpts.map((no) => {
        const forward = overlapScore(normAnswer, no);
        const backward = overlapScore(no, normAnswer);
        return Math.min(forward, backward); // require BOTH directions
      }),
    );
    if (bestOverlap >= 0.5) {
      return 0.30 + bestOverlap * 0.30; // 0.45–0.60
    }

    return 0;
  }

  // Build suggestions for ALL top pairs, then pick the best one
  type ScoredSuggestion = {
    suggestion: ExtensionQuestionSuggestion;
    choiceScore: number;
    pairIndex: number;
  };
  const scoredSuggestions: ScoredSuggestion[] = [];

  for (let i = 0; i < topPairs.length; i++) {
    const pair = topPairs[i]!;
    const suggestion = buildQaSuggestion(pair, retrievalStatus, 'subject_folder');
    if (!suggestion) continue;

    const choiceScore = scoreAnswerChoiceAlignment(pair.answer_text);
    scoredSuggestions.push({ suggestion, choiceScore, pairIndex: i });
  }

  if (hasOptions && scoredSuggestions.length > 0) {
    // Sort by choice alignment score (descending), then by original rank
    scoredSuggestions.sort((a, b) => {
      // Hard tier gap: if one has a strong match (≥ 0.9) and another doesn't, force it
      const aStrong = a.choiceScore >= 0.9;
      const bStrong = b.choiceScore >= 0.9;
      if (aStrong !== bStrong) return aStrong ? -1 : 1;

      // Within the same tier, use score difference
      if (Math.abs(b.choiceScore - a.choiceScore) >= 0.05) {
        return b.choiceScore - a.choiceScore;
      }

      // Tie-break: original ranking order (from retrieval)
      return a.pairIndex - b.pairIndex;
    });

    // Pick the best choice-aligned suggestion
    const best = scoredSuggestions[0]!;
    if (best.suggestion.suggestedOption || best.choiceScore > 0) {
      return best.suggestion;
    }

    // If nothing has good choice alignment, fall back to first with suggestedOption
    const firstWithOption = scoredSuggestions.find((s) => s.suggestion.suggestedOption);
    if (firstWithOption) return firstWithOption.suggestion;

    // Last resort: first available suggestion
    return scoredSuggestions[0]!.suggestion;
  }

  // No choices on the page — just use the top-ranked pair
  if (scoredSuggestions.length > 0) {
    const firstWithOption = scoredSuggestions.find((s) => s.suggestion.suggestedOption);
    if (firstWithOption) return firstWithOption.suggestion;
    return scoredSuggestions[0]!.suggestion;
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
  globalOptions: string[];
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
      globalOptions: params.globalOptions,
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
    globalOptions: extracted.options ?? [],
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
      usedSecondsDelta: 0,
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
      questionType: null,
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
