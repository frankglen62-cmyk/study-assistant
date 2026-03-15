import { createHash } from 'node:crypto';

import { clamp } from '@study-assistant/shared-utils';
import type { ExtensionPageSignals } from '@study-assistant/shared-types';

import { resolveSuggestedOption } from '@/lib/ai/choice-matching';
import { retrievalChunkSchema } from '@/lib/supabase/schemas';

const EMBEDDING_DIMENSIONS = 1536;

function tokenize(value: string) {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function countSharedTokens(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  if (leftTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of tokenize(right)) {
    if (leftTokens.has(token)) {
      matches += 1;
    }
  }

  return matches;
}

function firstSentence(value: string) {
  const sentence = value
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .find((item) => item.length >= 12);

  return sentence ?? value.trim();
}

export function createDeterministicEmbedding(input: string) {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  const tokens = tokenize(input);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const hash = createHash('sha256').update(token).digest();

    for (let index = 0; index < 8; index += 1) {
      const left = hash[index * 2] ?? 0;
      const right = hash[index * 2 + 1] ?? 0;
      const signByte = hash[31 - index] ?? 0;
      const weightByte = hash[16 + index] ?? 0;
      const slot = ((left << 8) | right) % EMBEDDING_DIMENSIONS;
      const sign = signByte % 2 === 0 ? 1 : -1;
      const weight = 1 + weightByte / 255;
      vector[slot] = (vector[slot] ?? 0) + sign * weight;
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

export function extractQuestionHeuristically(pageSignals: ExtensionPageSignals) {
  const firstCandidate = pageSignals.questionCandidates[0] ?? null;
  const directQuestion = pageSignals.questionText?.trim() ?? '';
  const directOptions = (firstCandidate?.options.length ? firstCandidate.options : pageSignals.options)
    .map((option) => option.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 10);
  const candidateQuestion = firstCandidate?.prompt?.trim() ?? '';

  if (directQuestion.length >= 8 || candidateQuestion.length >= 8) {
    const resolvedQuestion = directQuestion.length >= 8 ? directQuestion : candidateQuestion;
    return {
      questionText: resolvedQuestion,
      options: directOptions,
      answerType:
        directOptions.length >= 2
          ? 'multiple_choice'
          : /true or false/i.test(resolvedQuestion)
            ? 'true_false'
            : 'short_form',
    } as const;
  }

  const questionCandidate =
    pageSignals.visibleTextExcerpt
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .find((item) => item.includes('?') && item.length >= 12) ??
    pageSignals.headings.find((item) => item.trim().length >= 12) ??
    pageSignals.visibleLabels.find((item) => item.trim().length >= 12) ??
    pageSignals.visibleTextExcerpt.trim().slice(0, 220) ??
    null;

  const normalizedQuestion = questionCandidate && questionCandidate.length >= 8 ? questionCandidate : null;

  return {
    questionText: normalizedQuestion,
    options: directOptions,
    answerType:
      directOptions.length >= 2
        ? 'multiple_choice'
        : normalizedQuestion && /true or false/i.test(normalizedQuestion)
          ? 'true_false'
          : 'short_form',
  } as const;
}

export function buildFallbackAnswerSuggestion(params: {
  questionText: string;
  options: string[];
  subjectName: string;
  categoryName: string | null;
  chunks: Array<ReturnType<typeof retrievalChunkSchema.parse>>;
}) {
  const topChunk = params.chunks[0];

  if (!topChunk) {
    return {
      answerText: null,
      shortExplanation: null,
      suggestedOption: null,
      confidence: 0.35,
      warning: 'No retrieval match is available for the fallback answer path.',
    };
  }

  const referenceText = `${topChunk.heading ?? ''} ${topChunk.text_content} ${params.questionText}`;

  const suggestedOption = resolveSuggestedOption(params.options, referenceText, params.questionText);
  const fallbackText = firstSentence(topChunk.text_content).slice(0, 180);
  const answerText = suggestedOption ?? fallbackText;
  const baseConfidence = suggestedOption ? 0.62 : 0.48;

  return {
    answerText,
    shortExplanation: suggestedOption
      ? `The strongest retrieved ${topChunk.heading ? `${topChunk.heading.toLowerCase()} section` : 'study section'} supports this option.`
      : `The strongest retrieved ${params.subjectName}${params.categoryName ? ` / ${params.categoryName}` : ''} material contains the matching concept.`,
    suggestedOption,
    confidence: clamp(baseConfidence + Math.min(topChunk.similarity * 0.22, 0.18), 0.35, 0.8),
    warning: 'Model fallback was used because the AI service is currently unavailable.',
  };
}
