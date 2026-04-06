import {
  retrievalChunkSchema,
  retrievalQaPairSchema,
  type CategoryRecord,
  type SubjectRecord,
} from '@/lib/supabase/schemas';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env/server';
import { createEmbedding } from '@/lib/ai/openai';
import {
  countBlankMarkers,
  isQuestionTextEquivalent,
  normalizeComparableText,
  normalizeQuestionLookupSkeleton,
  normalizeQuestionLookupText,
  overlapScore,
  resolveSuggestedOption,
  scoreBlankStructureAlignment,
  splitMultiAnswerSegments,
  splitMultiAnswerByChoices,
} from '@/lib/ai/choice-matching';
import { logEvent } from '@/lib/observability/logger';
import { RouteError } from '@/lib/http/route';

export interface RetrievalResult {
  chunks: Array<ReturnType<typeof retrievalChunkSchema.parse>>;
  retrievalConfidence: number | null;
  retrievalStatus: string;
}

export interface QaPairRetrievalResult {
  pairs: Array<ReturnType<typeof retrievalQaPairSchema.parse>>;
  retrievalConfidence: number | null;
  retrievalStatus: string;
}

interface FallbackSourceFileRow {
  id: string;
  title: string;
  source_priority: number;
}

interface FallbackChunkRow {
  id: string;
  source_file_id: string;
  subject_id: string;
  category_id: string | null;
  folder_id: string | null;
  heading: string | null;
  text_content: string;
  metadata: Record<string, unknown> | null;
}

interface QaPairRow {
  id: string;
  subject_id: string;
  category_id: string | null;
  question_text: string;
  answer_text: string;
  short_explanation: string | null;
  keywords: string[] | null;
  sort_order: number;
  subjects?: { name: string } | { name: string }[] | null;
  categories?: { name: string } | { name: string }[] | null;
  updated_at: string;
}

export type PreloadedQaPairRow = QaPairRow;

const QA_PRELOAD_CACHE_TTL_MS = 1_000;
const preloadedQaPairCache = new Map<string, { rows: QaPairRow[]; expiresAt: number }>();
const preloadedQaPairPromises = new Map<string, Promise<QaPairRow[]>>();

function getPreloadedQaPairCacheKey(params: { subject: SubjectRecord; category: CategoryRecord | null }) {
  return `${params.subject.id}:${params.category?.id ?? 'all'}`;
}

export function invalidatePreloadedQaPairCache(subjectId?: string | null) {
  if (!subjectId) {
    preloadedQaPairCache.clear();
    preloadedQaPairPromises.clear();
    return;
  }

  for (const key of preloadedQaPairCache.keys()) {
    if (key.startsWith(`${subjectId}:`)) {
      preloadedQaPairCache.delete(key);
    }
  }

  for (const key of preloadedQaPairPromises.keys()) {
    if (key.startsWith(`${subjectId}:`)) {
      preloadedQaPairPromises.delete(key);
    }
  }
}

export async function preloadSubjectQaPairs(params: {
  subject: SubjectRecord;
  category: CategoryRecord | null;
}) {
  const cacheKey = getPreloadedQaPairCacheKey(params);
  const cached = preloadedQaPairCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  const inFlight = preloadedQaPairPromises.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const loadRows = (async () => {
    const supabase = getSupabaseAdmin();
    const pageSize = 1000;
    const allRows: QaPairRow[] = [];
    let offset = 0;

    while (true) {
      let query = supabase
        .from('subject_qa_pairs')
        .select(`
          id,
          subject_id,
          category_id,
          question_text,
          answer_text,
          short_explanation,
          keywords,
          sort_order,
          updated_at,
          subjects:subject_id (
            name
          ),
          categories:category_id (
            name
          )
        `)
        .eq('subject_id', params.subject.id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (params.category) {
        query = query.or(`category_id.eq.${params.category.id},category_id.is.null`);
      }

      const { data, error } = await query;

      if (error) {
        const rawMessage = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
        if (rawMessage.includes('subject_qa_pairs') && (rawMessage.includes('does not exist') || rawMessage.includes('schema cache'))) {
          return [];
        }
        throw new RouteError(500, 'qa_retrieval_failed', 'Q&A preload failed.', error.message);
      }

      const batch = (data ?? []) as QaPairRow[];
      allRows.push(...batch);

      if (batch.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    preloadedQaPairCache.set(cacheKey, {
      rows: allRows,
      expiresAt: Date.now() + QA_PRELOAD_CACHE_TTL_MS,
    });

    return allRows;
  })().finally(() => {
    preloadedQaPairPromises.delete(cacheKey);
  });

  preloadedQaPairPromises.set(cacheKey, loadRows);
  return loadRows;
}

export function rankQaPairRowsLocal(params: {
  rows: QaPairRow[];
  queryText: string;
  options?: string[];
  subjectNameFallback?: string | null;
  categoryNameFallback?: string | null;
}) {
  return rankQaPairRows(params);
}

function isExactQuestionMatch(queryText: string, questionText: string) {
  return isQuestionTextEquivalent(queryText, questionText);
}

function rankQaPairRows(params: {
  rows: QaPairRow[];
  queryText: string;
  options?: string[];
  subjectNameFallback?: string | null;
  categoryNameFallback?: string | null;
}) {
  const rankedRows = params.rows
    .map((row) =>
      retrievalQaPairSchema.parse({
        ...row,
        keywords: row.keywords ?? [],
        subject_name: pickJoinedName(row.subjects) ?? params.subjectNameFallback ?? null,
        category_name: pickJoinedName(row.categories) ?? params.categoryNameFallback ?? null,
        similarity: qaPairScore({
          queryText: params.queryText,
          options: params.options ?? [],
          pair: row,
        }),
      }),
    )
    .filter((row) => row.similarity >= 0.16);

  const opts = params.options ?? [];
  const hasChoices = opts.length > 0;

  const exactMatches = rankedRows
    .filter((row) => isExactQuestionMatch(params.queryText, row.question_text));

  // ── Choice-aware hard disambiguation for duplicate questions ──────────
  // When the same question text has multiple Q&A pairs with different answers,
  // we MUST pick the pair whose answer matches one of the visible choices.
  // Compute choice alignment scores up-front for all exact matches.
  const exactMatchScores = exactMatches.map((row) => ({
    row,
    choiceScore: hasChoices ? scoreAnswerAgainstOptions(opts, row.answer_text) : 0,
    blankAlignment: scoreBlankStructureAlignment(params.queryText, row.question_text),
  }));

  // Diagnostic: log when duplicate questions are found with different choice scores
  if (exactMatchScores.length >= 2 && hasChoices) {
    const distinctAnswers = new Set(exactMatchScores.map((e) => normalizeComparableText(e.row.answer_text)));
    if (distinctAnswers.size >= 2) {
      logEvent('info', 'ai.retrieval.duplicate_question_disambiguation', {
        queryText: params.queryText.slice(0, 120),
        candidateCount: exactMatchScores.length,
        scores: exactMatchScores.map((e) => ({
          answerId: e.row.id,
          answer: e.row.answer_text.slice(0, 80),
          choiceScore: e.choiceScore,
          blankAlignment: e.blankAlignment,
        })),
        options: opts.slice(0, 8).map((o) => o.slice(0, 80)),
      });
    }
  }

  // Sort exact matches: choice alignment is the PRIMARY criterion when choices exist.
  // This ensures that when question #8 has choices [A,B,C,D] and question #30 has
  // choices [E,F,G,H], the pair whose answer matches the current choices always wins.
  exactMatchScores.sort((a, b) => {
    // If choices are present, choice alignment is the DOMINANT factor.
    if (hasChoices) {
      // Hard tier separation: Tier 1 (1.0) >> Tier 2 (0.96) >> Tier 3 (0.35) >> Tier 4 (< 0.35)
      // Any pair with a significantly higher choice score wins, period.
      const choiceDelta = b.choiceScore - a.choiceScore;
      if (Math.abs(choiceDelta) >= 0.05) {
        return choiceDelta;
      }
    }

    // Secondary: blank structure alignment
    const blankDelta = b.blankAlignment - a.blankAlignment;
    if (blankDelta !== 0) {
      return blankDelta;
    }

    // Tertiary: choice score (for small differences)
    if (hasChoices) {
      const smallChoiceDelta = b.choiceScore - a.choiceScore;
      if (smallChoiceDelta !== 0) {
        return smallChoiceDelta;
      }
    }

    // Quaternary: category specificity
    const categoryDelta = Number(Boolean(b.row.category_id)) - Number(Boolean(a.row.category_id));
    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    // Last resort: most recently updated
    return new Date(b.row.updated_at).getTime() - new Date(a.row.updated_at).getTime();
  });

  const sortedExactMatches = exactMatchScores.map((e) => e.row);
  const exactMatchIds = new Set(sortedExactMatches.map((row) => row.id));
  const nonExactMatches = rankedRows
    .filter((row) => !exactMatchIds.has(row.id))
    .sort(
      (left, right) =>
        right.similarity - left.similarity ||
        scoreBlankStructureAlignment(params.queryText, right.question_text) -
        scoreBlankStructureAlignment(params.queryText, left.question_text) ||
        Number(Boolean(right.category_id)) - Number(Boolean(left.category_id)) ||
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
    );

  return [...sortedExactMatches, ...nonExactMatches].slice(0, 12);
}

function pickJoinedName(value: QaPairRow['subjects'] | QaPairRow['categories']) {
  if (Array.isArray(value)) {
    return value[0]?.name ?? null;
  }

  return value?.name ?? null;
}

function tokenize(value: string) {
  return normalizeComparableText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function scoreAnswerAgainstOptions(options: string[], answerText: string) {
  if (options.length === 0) {
    return 0;
  }

  // ── Tiered scoring for duplicate-question disambiguation ──────────────
  const normalizedAnswer = normalizeComparableText(answerText);

  if (normalizedAnswer) {
    const normalizedOpts = options.map((o) => normalizeComparableText(o)).filter(Boolean);

    // Tier 1: exact full-answer text matches a choice → 1.0
    if (normalizedOpts.some((no) => no === normalizedAnswer)) {
      return 1.0;
    }

    // Tier 2: near-exact containment (high length ratio) → 0.92
    for (const no of normalizedOpts) {
      const shorter = Math.min(no.length, normalizedAnswer.length);
      const longer = Math.max(no.length, normalizedAnswer.length);
      if (
        shorter > 0 &&
        longer > 0 &&
        shorter / longer >= 0.80 &&
        (no.includes(normalizedAnswer) || normalizedAnswer.includes(no))
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
        const segmentHit = normalizedOpts.some((no) => {
          if (no === normSegment) return true;
          const shorter = Math.min(no.length, normSegment.length);
          const longer = Math.max(no.length, normSegment.length);
          if (shorter > 0 && longer > 0 && shorter / longer >= 0.75 &&
            (no.includes(normSegment) || normSegment.includes(no))) return true;
          const fwd = overlapScore(normSegment, no);
          const bwd = overlapScore(no, normSegment);
          return Math.min(fwd, bwd) >= 0.75;
        });
        if (segmentHit) segmentMatches++;
      }
      if (segmentMatches >= 2) {
        // Score proportional to match rate: 4/4 = 0.88, 3/4 = 0.78, 2/4 = 0.65
        return 0.42 + (segmentMatches / multiSegments.length) * 0.46;
      }
    }

    // Fallback: concatenated answers without commas
    const choicesBySubstring = splitMultiAnswerByChoices(answerText, options);
    if (choicesBySubstring.length >= 2) {
      return 0.42 + (choicesBySubstring.length / Math.max(choicesBySubstring.length, 4)) * 0.46;
    }

    // Tier 2.5: high token overlap between answer and a choice → 0.60–0.75
    const bestTokenOverlap = Math.max(
      ...normalizedOpts.map((no) => {
        const forward = overlapScore(normalizedAnswer, no);
        const backward = overlapScore(no, normalizedAnswer);
        return Math.min(forward, backward);
      }),
    );
    if (bestTokenOverlap >= 0.85) {
      return 0.60 + bestTokenOverlap * 0.15; // 0.73–0.75
    }
  }

  // Tier 3: resolveSuggestedOption found a match (partial/segment) → 0.25
  if (resolveSuggestedOption(options, answerText)) {
    return 0.25;
  }

  const multiSegments = splitMultiAnswerSegments(answerText);
  if (multiSegments.length >= 2) {
    const matchedSegments = multiSegments.filter((segment) => Boolean(resolveSuggestedOption(options, segment))).length;
    if (matchedSegments > 0) {
      return (matchedSegments / multiSegments.length) * 0.20;
    }
  }

  // Tier 4: pure lexical overlap — lowest possible score
  const bestLex = Math.max(
    ...options.map((option) =>
      Math.max(
        lexicalScore(option, answerText),
        lexicalScore(answerText, option),
      ),
    ),
  );
  // Cap at 0.18 so it never competes with Tier 3
  return Math.min(bestLex, 0.18);
}


function lexicalScore(queryText: string, chunkText: string) {
  const queryTokens = Array.from(new Set(tokenize(queryText))).filter((token) => token.length >= 2);
  if (queryTokens.length === 0) {
    return 0;
  }

  const chunkTokens = new Set(tokenize(chunkText));
  const matches = queryTokens.filter((token) => chunkTokens.has(token)).length;
  return matches / queryTokens.length;
}

function qaPairScore(params: {
  queryText: string;
  options: string[];
  pair: QaPairRow;
}) {
  const normalizedQuery = normalizeQuestionLookupText(params.queryText);
  const normalizedQuestion = normalizeQuestionLookupText(params.pair.question_text);
  const normalizedQuerySkeleton = normalizeQuestionLookupSkeleton(params.queryText);
  const normalizedQuestionSkeleton = normalizeQuestionLookupSkeleton(params.pair.question_text);
  const blankAlignment = scoreBlankStructureAlignment(params.queryText, params.pair.question_text);

  if (isQuestionTextEquivalent(params.queryText, params.pair.question_text)) {
    return Math.max(0, Math.min(0.995 + blankAlignment * 0.002, 0.999));
  }

  const questionScore = lexicalScore(params.queryText, params.pair.question_text);
  const answerScore = lexicalScore(params.queryText, params.pair.answer_text);
  const containmentBoost =
    normalizedQuery &&
      normalizedQuestion &&
      (
        normalizedQuery.includes(normalizedQuestion) ||
        normalizedQuestion.includes(normalizedQuery) ||
        (normalizedQuerySkeleton &&
          normalizedQuestionSkeleton &&
          (normalizedQuerySkeleton.includes(normalizedQuestionSkeleton) ||
            normalizedQuestionSkeleton.includes(normalizedQuerySkeleton)))
      )
      ? 0.28
      : 0;
  const keywordScore =
    (params.pair.keywords ?? []).filter((keyword) => params.queryText.toLowerCase().includes(keyword.toLowerCase())).length *
    0.08;
  const optionSupport = params.options.length
    ? Math.max(
      ...params.options.map((option) =>
        Math.max(
          lexicalScore(option, params.pair.answer_text),
          lexicalScore(option, params.pair.question_text),
        ),
      ),
    )
    : 0;

  const extractSignificantNumbers = (text: string) => {
    return Array.from(new Set(
      (text.match(/\b\d+(?:[.,]\d+)+\b|\b\d{2,}\b/g) ?? [])
    ));
  };

  const queryNums = extractSignificantNumbers(params.queryText);
  const pairNums = extractSignificantNumbers(params.pair.question_text);

  let numberPenalty = 0;
  if (queryNums.length > 0 || pairNums.length > 0) {
    const unmatchedPairNums = pairNums.filter(n => !queryNums.includes(n));
    const unmatchedQueryNums = queryNums.filter(n => !pairNums.includes(n));

    if (unmatchedPairNums.length > 0 && unmatchedQueryNums.length > 0) {
      numberPenalty = 0.5;
    } else if (unmatchedPairNums.length > 0) {
      numberPenalty = 0.3;
    }
  }

  const blankPenalty =
    countBlankMarkers(params.queryText) > 0 && countBlankMarkers(params.pair.question_text) === 0 ? 0.18 : 0;

  const blankBonus = blankAlignment > 0.5 ? 0.06 : blankAlignment > 0 ? 0.03 : 0;

  // For dropdown questions (5+ shared options), optionSupport is misleading because
  // every sub-question shares the same options. Heavily discount it to prevent one
  // Q&A pair from ranking highly for all sub-questions.
  const optionSupportWeight = params.options.length >= 5 ? 0.04 : 0.16;

  const baseScore = Math.min(
    questionScore * 0.76 + answerScore * 0.14 + optionSupport * optionSupportWeight + keywordScore + containmentBoost + blankBonus,
    0.99,
  );
  return Math.max(0, baseScore - numberPenalty - blankPenalty);
}

async function retrieveByKeywordFallback(params: {
  subject: SubjectRecord;
  category: CategoryRecord | null;
  queryText: string;
}) {
  const supabase = getSupabaseAdmin();
  let fileQuery = supabase
    .from('source_files')
    .select('id, title, source_priority')
    .eq('subject_id', params.subject.id)
    .eq('source_status', 'active')
    .is('deleted_at', null)
    .is('archived_at', null)
    .limit(40);

  if (params.category) {
    fileQuery = fileQuery.or(`category_id.eq.${params.category.id},category_id.is.null`);
  }

  const { data: sourceFiles, error: sourceFileError } = await fileQuery;

  if (sourceFileError) {
    throw new RouteError(500, 'retrieval_failed', 'Keyword fallback source lookup failed.', sourceFileError.message);
  }

  const activeSourceFiles = (sourceFiles ?? []) as FallbackSourceFileRow[];
  if (activeSourceFiles.length === 0) {
    return [];
  }

  const sourceFileIds = activeSourceFiles.map((row) => row.id);
  const sourceFileById = new Map(activeSourceFiles.map((row) => [row.id, row]));

  let chunkQuery = supabase
    .from('source_chunks')
    .select('id, source_file_id, subject_id, category_id, folder_id, heading, text_content, metadata')
    .eq('is_active', true)
    .eq('subject_id', params.subject.id)
    .in('source_file_id', sourceFileIds)
    .limit(80);

  if (params.category) {
    chunkQuery = chunkQuery.or(`category_id.eq.${params.category.id},category_id.is.null`);
  }

  const { data, error } = await chunkQuery;

  if (error) {
    throw new RouteError(500, 'retrieval_failed', 'Keyword fallback chunk lookup failed.', error.message);
  }

  return ((data ?? []) as FallbackChunkRow[])
    .map((row) => {
      const source = sourceFileById.get(row.source_file_id) ?? null;
      const similarity = lexicalScore(params.queryText, `${row.heading ?? ''} ${row.text_content}`);

      return retrievalChunkSchema.parse({
        chunk_id: row.id,
        source_file_id: row.source_file_id,
        subject_id: row.subject_id,
        category_id: row.category_id,
        folder_id: row.folder_id,
        heading: row.heading,
        text_content: row.text_content,
        similarity,
        source_title: source?.title ?? 'Source',
        source_priority: source?.source_priority ?? 0,
        chunk_metadata: row.metadata ?? {},
      });
    })
    .filter((row) => row.similarity >= 0.12)
    .sort((left, right) => right.similarity - left.similarity || right.source_priority - left.source_priority)
    .slice(0, env.RETRIEVAL_MATCH_COUNT);
}

export async function retrieveRelevantChunks(params: {
  subject: SubjectRecord;
  category: CategoryRecord | null;
  queryText: string;
}) {
  const embedding = await createEmbedding(params.queryText);
  const supabase = getSupabaseAdmin();

  const primary = await supabase.rpc('match_source_chunks', {
    p_query_embedding: embedding,
    p_subject_id: params.subject.id,
    p_category_id: params.category?.id ?? null,
    p_match_count: env.RETRIEVAL_MATCH_COUNT,
    p_min_similarity: env.RETRIEVAL_MIN_SIMILARITY,
  });

  if (primary.error) {
    throw new RouteError(500, 'retrieval_failed', 'Vector retrieval failed.', primary.error.message);
  }

  let rows = (primary.data ?? []).map((row: unknown) => retrievalChunkSchema.parse(row));

  if (rows.length === 0 && params.category) {
    const fallback = await supabase.rpc('match_source_chunks', {
      p_query_embedding: embedding,
      p_subject_id: params.subject.id,
      p_category_id: null,
      p_match_count: env.RETRIEVAL_MATCH_COUNT,
      p_min_similarity: env.RETRIEVAL_MIN_SIMILARITY,
    });

    if (fallback.error) {
      throw new RouteError(500, 'retrieval_failed', 'Subject-level fallback retrieval failed.', fallback.error.message);
    }

    rows = (fallback.data ?? []).map((row: unknown) => retrievalChunkSchema.parse(row));
  }

  if (rows.length === 0) {
    rows = await retrieveByKeywordFallback(params);
  }

  const topSimilarities = rows.slice(0, 3).map((chunk: { similarity: number }) => chunk.similarity);
  const retrievalConfidence: number | null =
    topSimilarities.length > 0
      ? topSimilarities.reduce((sum: number, value: number) => sum + value, 0) / topSimilarities.length
      : null;

  return {
    chunks: rows,
    retrievalConfidence,
    retrievalStatus:
      rows.length > 0
        ? `Matched ${rows.length} chunk${rows.length === 1 ? '' : 's'} in ${params.subject.name}${params.category ? ` / ${params.category.name}` : ''}.`
        : `No matching active source chunks were found for ${params.subject.name}${params.category ? ` / ${params.category.name}` : ''}.`,
  } satisfies RetrievalResult;
}

export async function retrieveRelevantQaPairs(params: {
  subject: SubjectRecord;
  category: CategoryRecord | null;
  queryText: string;
  options?: string[];
}) {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const allRows: QaPairRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from('subject_qa_pairs')
      .select(`
        id,
        subject_id,
        category_id,
        question_text,
        answer_text,
        short_explanation,
        keywords,
        sort_order,
        updated_at,
        subjects:subject_id (
          name
        ),
        categories:category_id (
          name
        )
      `)
      .eq('subject_id', params.subject.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (params.category) {
      query = query.or(`category_id.eq.${params.category.id},category_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      const rawMessage = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
      if (rawMessage.includes('subject_qa_pairs') && (rawMessage.includes('does not exist') || rawMessage.includes('schema cache'))) {
        return {
          pairs: [],
          retrievalConfidence: null,
          retrievalStatus:
            'Subject answer storage is not available yet for this project. File-based retrieval remains active.',
        } satisfies QaPairRetrievalResult;
      }

      throw new RouteError(500, 'qa_retrieval_failed', 'Q&A retrieval failed.', error.message);
    }

    const batch = (data ?? []) as QaPairRow[];
    allRows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  let candidateRows = allRows;

  if (params.category && !allRows.some((row) => isExactQuestionMatch(params.queryText, row.question_text))) {
    const subjectFallbackRows: QaPairRow[] = [];
    let subjectFallbackOffset = 0;

    while (true) {
      const { data, error } = await supabase
        .from('subject_qa_pairs')
        .select(`
          id,
          subject_id,
          category_id,
          question_text,
          answer_text,
          short_explanation,
          keywords,
          sort_order,
          updated_at,
          subjects:subject_id (
            name
          ),
          categories:category_id (
            name
          )
        `)
        .eq('subject_id', params.subject.id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .range(subjectFallbackOffset, subjectFallbackOffset + pageSize - 1);

      if (error) {
        throw new RouteError(500, 'qa_retrieval_failed', 'Subject-level exact-match fallback failed.', error.message);
      }

      const batch = (data ?? []) as QaPairRow[];
      subjectFallbackRows.push(...batch);

      if (batch.length < pageSize) {
        break;
      }

      subjectFallbackOffset += pageSize;
    }

    const fallbackExactRows = subjectFallbackRows.filter((row) => isExactQuestionMatch(params.queryText, row.question_text));
    if (fallbackExactRows.length > 0) {
      const seenIds = new Set(candidateRows.map((row) => row.id));
      candidateRows = [...fallbackExactRows.filter((row) => !seenIds.has(row.id)), ...candidateRows];
    }
  }

  const rows = rankQaPairRows({
    rows: candidateRows,
    queryText: params.queryText,
    options: params.options ?? [],
    subjectNameFallback: params.subject.name,
    categoryNameFallback: params.category?.name ?? null,
  });

  const topSimilarities = rows.slice(0, 3).map((pair) => pair.similarity);
  const retrievalConfidence =
    topSimilarities.length > 0
      ? topSimilarities.reduce((sum, value) => sum + value, 0) / topSimilarities.length
      : null;

  return {
    pairs: rows,
    retrievalConfidence,
    retrievalStatus:
      rows.length > 0
        ? `Matched ${rows.length} stored answer pair${rows.length === 1 ? '' : 's'} in ${params.subject.name}${params.category ? ` / ${params.category.name}` : ''}.`
        : `No matching subject answer pairs were found for ${params.subject.name}${params.category ? ` / ${params.category.name}` : ''}.`,
  } satisfies QaPairRetrievalResult;
}

export async function retrieveRelevantQaPairsAcrossSubjects(params: {
  queryText: string;
  options?: string[];
  excludeSubjectId?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const rows: QaPairRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from('subject_qa_pairs')
      .select(`
        id,
        subject_id,
        category_id,
        question_text,
        answer_text,
        short_explanation,
        keywords,
        sort_order,
        updated_at,
        subjects:subject_id (
          name
        ),
        categories:category_id (
          name
        )
      `)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (params.excludeSubjectId) {
      query = query.neq('subject_id', params.excludeSubjectId);
    }

    const { data, error } = await query;

    if (error) {
      const rawMessage = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
      if (rawMessage.includes('subject_qa_pairs') && (rawMessage.includes('does not exist') || rawMessage.includes('schema cache'))) {
        return {
          pairs: [],
          retrievalConfidence: null,
          retrievalStatus:
            'Subject answer storage is not available yet for this project. Cross-subject fallback is unavailable.',
        } satisfies QaPairRetrievalResult;
      }

      throw new RouteError(500, 'qa_retrieval_failed', 'Cross-subject Q&A fallback failed.', error.message);
    }

    const batch = (data ?? []) as QaPairRow[];
    rows.push(...batch);

    if (batch.length < pageSize || rows.length >= 5000) {
      break;
    }

    offset += pageSize;
  }

  const rankedRows = rankQaPairRows({
    rows,
    queryText: params.queryText,
    options: params.options ?? [],
    subjectNameFallback: null,
    categoryNameFallback: null,
  });

  const topSimilarities = rankedRows.slice(0, 3).map((pair) => pair.similarity);
  const retrievalConfidence =
    topSimilarities.length > 0
      ? topSimilarities.reduce((sum, value) => sum + value, 0) / topSimilarities.length
      : null;

  return {
    pairs: rankedRows,
    retrievalConfidence,
    retrievalStatus:
      rankedRows.length > 0
        ? `Matched ${rankedRows.length} answer pair${rankedRows.length === 1 ? '' : 's'} across all subject folders.`
        : 'No matching answer pair was found across all subject folders.',
  } satisfies QaPairRetrievalResult;
}
