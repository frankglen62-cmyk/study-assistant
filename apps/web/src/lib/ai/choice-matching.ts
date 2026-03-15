function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(/\p{M}+/gu, '');
}

function stripLeadingChoiceMarker(value: string) {
  return value.replace(/^\s*[(\[]?([a-z]|\d{1,2}|[ivxlcdm]{1,5})[)\].:-]?\s+/iu, '');
}

export function normalizeComparableText(value: string) {
  return collapseWhitespace(stripLeadingChoiceMarker(stripDiacritics(value)))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeComparableText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isBooleanToken(value: string) {
  return value === 'true' || value === 'false';
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
  const parsedOptions = options.map(parseChoiceOption);
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
