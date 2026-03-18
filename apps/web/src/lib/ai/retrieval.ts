import {
  retrievalChunkSchema,
  retrievalQaPairSchema,
  type CategoryRecord,
  type SubjectRecord,
} from '@/lib/supabase/schemas';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env/server';
import { createEmbedding } from '@/lib/ai/openai';
import { normalizeComparableText } from '@/lib/ai/choice-matching';
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

function isExactQuestionMatch(queryText: string, questionText: string) {
  const normalizedQuery = normalizeComparableText(queryText);
  const normalizedQuestion = normalizeComparableText(questionText);
  return Boolean(normalizedQuery && normalizedQuestion && normalizedQuery === normalizedQuestion);
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

  const exactMatches = rankedRows
    .filter((row) => isExactQuestionMatch(params.queryText, row.question_text))
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());

  const exactMatchIds = new Set(exactMatches.map((row) => row.id));
  const nonExactMatches = rankedRows
    .filter((row) => !exactMatchIds.has(row.id))
    .sort((left, right) => right.similarity - left.similarity || new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());

  return [...exactMatches, ...nonExactMatches].slice(0, 12);
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
  const normalizedQuery = normalizeComparableText(params.queryText);
  const normalizedQuestion = normalizeComparableText(params.pair.question_text);

  if (normalizedQuery && normalizedQuestion && normalizedQuery === normalizedQuestion) {
    return 0.995;
  }

  const questionScore = lexicalScore(params.queryText, params.pair.question_text);
  const answerScore = lexicalScore(params.queryText, params.pair.answer_text);
  const containmentBoost =
    normalizedQuery &&
    normalizedQuestion &&
    (normalizedQuery.includes(normalizedQuestion) || normalizedQuestion.includes(normalizedQuery))
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

  return Math.min(questionScore * 0.76 + answerScore * 0.14 + optionSupport * 0.16 + keywordScore + containmentBoost, 0.99);
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
