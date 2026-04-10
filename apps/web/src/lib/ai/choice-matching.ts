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

/**
 * Insert spaces before roman-numeral and letter list markers that got merged
 * with the preceding word during DOM text extraction.
 *
 * Examples:
 *   "customerii. SRS"  -> "customer ii. SRS"
 *   "developeriii. SRS" -> "developer iii. SRS"
 *   "test1. hello"     -> "test 1. hello"
 */
function normalizeListMarkers(value: string) {
  // Insert space before roman numeral markers (i. ii. iii. iv. v. vi. etc.)
  // Pattern: a letter immediately followed by a roman numeral + "." + space/end
  let result = value.replace(
    /([a-zA-Z])((?:viii|vii|vi|iv|ix|xii|xi|iii|ii|x|v|i)\.)(\s|$)/gi,
    '$1 $2$3'
  );

  // Insert space before single-letter markers: "texta. hello" -> "text a. hello"
  result = result.replace(
    /([a-zA-Z]{2,})([a-d]\.)(\s|$)/g,
    '$1 $2$3'
  );

  // Insert space before number markers: "test1. hello" -> "test 1. hello"
  result = result.replace(
    /([a-zA-Z]{2,})(\d{1,2}\.)(\s|$)/g,
    '$1 $2$3'
  );

  return result;
}

export function normalizeComparableText(value: string) {
  return collapseWhitespace(normalizeBlankMarkers(stripLeadingChoiceMarker(stripDiacritics(normalizeListMarkers(value)))))
    .toLowerCase()
    // Normalize semicolons to commas so "service-oriented; elastic" matches
    // "service-oriented, elastic" — the LMS and Q&A library often use them
    // interchangeably.
    .replace(/;/g, ',')
    // Strip Moodle review-page artifacts: checkmarks, correct/incorrect markers,
    // "Your answer is correct/incorrect", feedback text, etc.
    .replace(/[\u2713\u2714\u2715\u2716\u2717\u2718✓✗✔✘☑☐⬜⬛●○◉]/g, ' ')
    .replace(/\b(?:your answer is (?:correct|incorrect)|correct|incorrect|partially correct)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s.,+\-%=_#*@]+/gu, ' ')
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
  if (!value || !value.trim()) {
    return [];
  }

  // Priority 1: Newline-separated (how Q&A library stores checkbox answers)
  // e.g. "Grid Computing\nUtility Computing\nCloud Computing\nSoftware as a Service"
  const newlineSegments = value
    .split(/\r?\n+/)
    .map((s) => collapseWhitespace(s.replace(/^[\s\u2022\-\–\—\*•]+/, ''))) // strip leading bullet chars
    .filter((s) => s.length >= 2);
  if (newlineSegments.length >= 2 && newlineSegments.length <= 20) {
    return Array.from(new Set(newlineSegments));
  }

  const collapsed = collapseWhitespace(value);
  if (!collapsed) {
    return [];
  }

  const segments = collapsed
    .split(/\s*(?:\||,|;|\/|\band\b|&|\+)\s*/i)
    .map((segment) => collapseWhitespace(segment))
    .filter((segment) => segment.length >= 2);

  if (segments.length < 2 || segments.length > 8) {
    return [];
  }

  return Array.from(new Set(segments));
}

/**
 * Split a concatenated answer (no commas) by checking which visible choices
 * appear as substrings within the answer text. This handles answers like:
 * "Software as a Service Utility Computing Cloud Computing Grid Computing"
 * where no delimiter separates the individual answers.
 */
export function splitMultiAnswerByChoices(answerText: string, choices: string[]): string[] {
  const normalizedAnswer = normalizeComparableText(answerText);
  if (!normalizedAnswer || choices.length < 2) {
    return [];
  }

  const matchedChoices: string[] = [];
  for (const choice of choices) {
    const normalizedChoice = normalizeComparableText(choice);
    // Choice must be long enough to avoid false positives (e.g. short words like "a", "of")
    if (!normalizedChoice || normalizedChoice.length < 4) {
      continue;
    }

    if (
      normalizedAnswer.includes(normalizedChoice) ||
      answerText.toLowerCase().includes(choice.toLowerCase().replace(/^[a-e]\.\s*/i, '').trim())
    ) {
      matchedChoices.push(choice);
    }
  }

  // Only return if at least 2 choices matched — otherwise it's not a multi-answer
  return matchedChoices.length >= 2 ? matchedChoices : [];
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

// Stop words that carry little meaning for question matching.
// "windows" vs "browsers" differ by ONE word, but the 5 matching tokens
// ("it", "is", "a", "based", "application") are mostly stop words.
// Stripping them reveals the real content overlap: 2/3 = 0.667 instead of 5/6 = 0.833.
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'it', 'its', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'not', 'no', 'nor',
  'this', 'that', 'these', 'those', 'with', 'from', 'by', 'as',
  'has', 'have', 'had', 'will', 'would', 'can', 'could', 'may', 'might',
  'shall', 'should', 'do', 'does', 'did',
  'what', 'which', 'who', 'whom', 'where', 'when', 'how', 'why',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any',
  'also', 'just', 'only', 'very', 'so', 'too', 'than', 'then',
]);

export function contentOverlapScore(left: string, right: string) {
  const leftTokens = tokenize(left).filter((t) => !STOP_WORDS.has(t));
  const rightTokens = tokenize(right).filter((t) => !STOP_WORDS.has(t));

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 1; // If no content words, fall back to regular overlap
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);

  // Count how many left content words appear in right
  let leftInRight = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      leftInRight += 1;
    }
  }

  // Count how many right content words appear in left
  let rightInLeft = 0;
  for (const token of rightSet) {
    if (leftSet.has(token)) {
      rightInLeft += 1;
    }
  }

  // BIDIRECTIONAL MINIMUM: Both sides must contain each other's content words.
  // This catches ALL false-match scenarios:
  //
  //   "Mercury Tools browsers based application" vs "browsers based application"
  //   → left→right: 3/5=0.60, right→left: 3/3=1.0, min=0.60 → REJECT
  //
  //   "windows based application" vs "browsers based application"
  //   → left→right: 2/3=0.667, right→left: 2/3=0.667, min=0.667 → REJECT
  //
  //   "Support button open links uft gui testing" vs "Links button open uft gui testing help"
  //   → left→right: 6/7=0.857, right→left: 6/7=0.857, min=0.857 → REJECT
  //
  //   Identical → min(1.0, 1.0) → ACCEPT
  //
  //   "This is a browsers-based application" vs "It is a browsers-based application"
  //   → After stop-word removal both = {browsers, based, application}
  //   → min(1.0, 1.0) → ACCEPT (because "this" and "it" are stop words)
  const leftContainment = leftInRight / leftSet.size;
  const rightContainment = rightInLeft / rightSet.size;
  return Math.min(leftContainment, rightContainment);
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

export function resolveSuggestedOption(
  options: string[],
  answerText: string,
  questionText?: string | null,
  questionType?: string | null,
) {
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

  // ── Direct full-answer match (BEFORE multi-segment splitting) ────────
  // When an answer like "SAN Management, RAID Arrays and Tape drives" is
  // itself one of the available choices, the multi-segment split logic
  // would incorrectly return null because each comma/and-separated segment
  // also matches individual choices. Check for exact and near-exact
  // full-answer matches first to prevent this false negative.
  for (const option of parsedOptions) {
    if (option.normalizedText === normalizedAnswer || option.normalizedRaw === normalizedAnswer) {
      return option.display;
    }
  }

  // Near-exact containment: answer and choice are essentially the same text.
  // Require high length similarity (>= 85%) so a short answer like
  // "SAN Management" doesn't accidentally match a long choice.
  for (const option of parsedOptions) {
    const shorterLen = Math.min(option.normalizedText.length, normalizedAnswer.length);
    const longerLen = Math.max(option.normalizedText.length, normalizedAnswer.length);
    if (
      shorterLen > 0 &&
      longerLen > 0 &&
      shorterLen / longerLen >= 0.85 &&
      (option.normalizedText.includes(normalizedAnswer) || normalizedAnswer.includes(option.normalizedText))
    ) {
      return option.display;
    }
  }

  // ── Multi-answer segment matching (ONLY for checkbox questions) ──────
  // For radio / dropdown / fill-in-the-blank, we must NOT split the answer
  // into segments — the library answer IS the full text of a single choice.
  // Splitting "service-oriented, elastic, cost-efficient" on commas would
  // incorrectly match segments against different options and produce
  // pipe-separated garbage.
  const isMultiAnswerQuestion = !questionType || questionType === 'checkbox';

  const multiAnswerSegments = splitMultiAnswerSegments(answerText);
  if (isMultiAnswerQuestion && multiAnswerSegments.length >= 2) {
    const matchedSegments = multiAnswerSegments
      .map((segment) => {
        const bestSegmentMatch = parsedOptions
          .map((option) => ({
            display: option.display,
            score: scoreChoiceOption({ option, answerText: segment, questionText }),
          }))
          .sort((left, right) => right.score - left.score)[0];

        return bestSegmentMatch && bestSegmentMatch.score >= 0.70 ? bestSegmentMatch.display : null;
      })
      .filter((display): display is string => Boolean(display));

    const distinctMatches = Array.from(new Set(matchedSegments));
    // Return all matches as long as at least 2 segments matched
    // (no longer requires ALL segments to match)
    if (distinctMatches.length >= 2) {
      return distinctMatches.join(' | ');
    }
  }

  // Fallback for concatenated DB answers without commas (e.g. "Choice A Choice B Choice C")
  // Find all choices that are strictly contained within the raw answer text
  // Only for checkbox questions — for radio/dropdown, skip this path.
  if (isMultiAnswerQuestion) {
    const containedMatches = parsedOptions.filter((option) => {
      // Must be long enough to avoid false positive short words
      if (option.normalizedText.length > 3) {
        if (
          normalizedAnswer.includes(option.normalizedText) ||
          answerText.toLowerCase().includes(option.text.toLowerCase())
        ) {
          return true;
        }
      }
      return false;
    });

    if (containedMatches.length >= 2) {
      return containedMatches.map((o) => o.display).join(' | ');
    }
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

  if (!bestOption || bestOption.score < 0.65) {
    return null;
  }

  return bestOption.option.display;
}
