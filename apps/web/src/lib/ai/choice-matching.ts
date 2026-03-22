function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

const IGNORED_CHOICE_TEXT_PATTERN =
  /^(?:clear my choice|flag question|check|not yet answered|not answered|answered|finish review|finish attempt|marked out of|mark \d+|marks?|submit|save|cancel|next page|previous page|time left|jump to|quiz navigation|response:?|your answer:?|answer:?|choose\.{0,3}|choose an option)$/i;

function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(/\p{M}+/gu, '');
}

function stripLeadingChoiceMarker(value: string) {
  return value.replace(/^\s*[(\[]?([a-z]|\d{1,2}|[ivxlcdm]{1,5})[)\].:-]?\s+/iu, '');
}

function normalizeBlankMarkers(value: string) {
  return value
    .replace(/\b(?:fill\s+in\s+the\s+blank|fill-in-the-blank|blank|blanks)\b/giu, ' _ ')
    .replace(/[_\s]*_{2,}[_\s]*/g, ' _ ');
}

export function normalizeComparableText(value: string) {
  return collapseWhitespace(normalizeBlankMarkers(stripLeadingChoiceMarker(stripDiacritics(value))))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.,+\-%=_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeQuestionLookupText(value: string) {
  return normalizeComparableText(value)
    .replace(/\s*([.,;:!?])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeQuestionLookupSkeleton(value: string) {
  return normalizeQuestionLookupText(value)
    .replace(/\b_\b/g, ' ')
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countBlankMarkers(value: string) {
  return normalizeQuestionLookupText(value).match(/\b_\b/g)?.length ?? 0;
}

export function scoreBlankStructureAlignment(queryText: string, candidateText: string) {
  const queryBlankCount = countBlankMarkers(queryText);
  const candidateBlankCount = countBlankMarkers(candidateText);

  if (queryBlankCount === candidateBlankCount) {
    return queryBlankCount > 0 ? 1 : 0.5;
  }

  if (queryBlankCount > 0 && candidateBlankCount === 0) {
    return -1;
  }

  if (queryBlankCount === 0 && candidateBlankCount > 0) {
    return -0.35;
  }

  const maxBlankCount = Math.max(queryBlankCount, candidateBlankCount);
  if (maxBlankCount === 0) {
    return 0.5;
  }

  return 1 - Math.abs(queryBlankCount - candidateBlankCount) / maxBlankCount;
}

export function isQuestionTextEquivalent(left: string, right: string) {
  const normalizedLeft = normalizeQuestionLookupText(left);
  const normalizedRight = normalizeQuestionLookupText(right);

  if (normalizedLeft && normalizedRight && normalizedLeft === normalizedRight) {
    return true;
  }

  const skeletonLeft = normalizeQuestionLookupSkeleton(left);
  const skeletonRight = normalizeQuestionLookupSkeleton(right);
  return Boolean(skeletonLeft && skeletonRight && skeletonLeft === skeletonRight);
}

function tokenize(value: string) {
  return normalizeComparableText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isBooleanToken(value: string) {
  return value === 'true' || value === 'false';
}

export function isIgnoredChoiceOption(value: string) {
  const collapsed = collapseWhitespace(value);
  if (!collapsed) {
    return true;
  }

  return IGNORED_CHOICE_TEXT_PATTERN.test(collapsed.toLowerCase());
}

export function splitMultiAnswerSegments(value: string) {
  const collapsed = collapseWhitespace(value);
  if (!collapsed) {
    return [];
  }

  const segments = collapsed
    .split(/\s*(?:,|;|\/|\band\b|&|\+)\s*/i)
    .map((segment) => collapseWhitespace(segment))
    .filter((segment) => segment.length >= 2);

  if (segments.length < 2 || segments.length > 5) {
    return [];
  }

  return Array.from(new Set(segments));
}

function extractReferencedChoiceLabel(value: string) {
  const collapsed = collapseWhitespace(value);
  const direct = collapsed.match(/^(?:option\s+)?([a-z]|\d{1,2}|[ivxlcdm]{1,5})$/iu)?.[1];
  if (direct) {
    return direct.toUpperCase();
  }

  const embedded = collapsed.match(/\b(?:option|choice|answer)\s+([a-z]|\d{1,2}|[ivxlcdm]{1,5})\b/iu)?.[1];
  return embedded ? embedded.toUpperCase() : null;
}

export function overlapScore(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  if (leftTokens.size === 0) {
    return 0;
  }

  const rightTokens = new Set(tokenize(right));
  let hits = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      hits += 1;
    }
  }

  return hits / leftTokens.size;
}

export interface ParsedChoiceOption {
  raw: string;
  label: string | null;
  text: string;
  normalizedRaw: string;
  normalizedText: string;
  display: string;
}

export function parseChoiceOption(option: string): ParsedChoiceOption {
  const collapsed = collapseWhitespace(option);
  const match = collapsed.match(/^\s*[(\[]?([a-z]|\d{1,2}|[ivxlcdm]{1,5})[)\].:-]?\s+(.+)$/iu);
  const label = match?.[1] ? match[1].toUpperCase() : null;
  const text = collapseWhitespace(match?.[2] ?? collapsed);

  return {
    raw: collapsed,
    label,
    text,
    normalizedRaw: normalizeComparableText(collapsed),
    normalizedText: normalizeComparableText(text),
    display: label ? `${label}. ${text}` : collapsed,
  };
}

export function scoreChoiceOption(params: {
  option: ParsedChoiceOption;
  answerText: string;
  questionText?: string | null;
}) {
  const normalizedAnswer = normalizeComparableText(params.answerText);
  if (!normalizedAnswer) {
    return 0;
  }

  if (params.option.normalizedText === normalizedAnswer || params.option.normalizedRaw === normalizedAnswer) {
    return 1;
  }

  if (
    params.option.normalizedText &&
    (normalizedAnswer.includes(params.option.normalizedText) || params.option.normalizedText.includes(normalizedAnswer))
  ) {
    return 0.95;
  }

  const answerOverlap = Math.max(
    overlapScore(params.option.text, params.answerText),
    overlapScore(params.option.raw, params.answerText),
  );
  const questionPenalty =
    params.questionText && overlapScore(params.option.text, params.questionText) > answerOverlap + 0.35 ? 0.08 : 0;

  return Math.max(answerOverlap - questionPenalty, 0);
}

export function resolveSuggestedOption(options: string[], answerText: string, questionText?: string | null) {
  const parsedOptions = options
    .filter((option) => !isIgnoredChoiceOption(option))
    .map(parseChoiceOption)
    .filter((option) => !isIgnoredChoiceOption(option.raw) && Boolean(option.normalizedRaw));
  const normalizedAnswer = normalizeComparableText(answerText);
  const referencedLabel = extractReferencedChoiceLabel(answerText);

  if (referencedLabel) {
    const matchedByLabel = parsedOptions.find((option) => option.label === referencedLabel);
    if (matchedByLabel) {
      return matchedByLabel.display;
    }
  }

  if (isBooleanToken(normalizedAnswer)) {
    const booleanOption = parsedOptions.find(
      (option) => option.normalizedText === normalizedAnswer || option.normalizedRaw === normalizedAnswer,
    );
    if (booleanOption) {
      return booleanOption.display;
    }
  }

  const multiAnswerSegments = splitMultiAnswerSegments(answerText);
  if (multiAnswerSegments.length >= 2) {
    const matchedSegments = multiAnswerSegments
      .map((segment) =>
        parsedOptions.find((option) => scoreChoiceOption({ option, answerText: segment, questionText }) >= 0.85)?.display ?? null,
      )
      .filter((display): display is string => Boolean(display));

    const distinctMatches = Array.from(new Set(matchedSegments));
    if (distinctMatches.length >= 2) {
      return null;
    }
  }

  const exactTextMatch = parsedOptions.find(
    (option) =>
      option.normalizedText === normalizedAnswer ||
      option.normalizedRaw === normalizedAnswer ||
      (option.normalizedText &&
        (normalizedAnswer.includes(option.normalizedText) || option.normalizedText.includes(normalizedAnswer))),
  );

  if (exactTextMatch) {
    return exactTextMatch.display;
  }

  const bestOption = parsedOptions
    .map((option) => ({
      option,
      score: scoreChoiceOption({
        option,
        answerText,
        questionText,
      }),
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (!bestOption || bestOption.score < 0.2) {
    return null;
  }

  return bestOption.option.display;
}
