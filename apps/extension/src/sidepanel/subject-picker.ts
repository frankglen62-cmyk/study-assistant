export interface SubjectCatalogEntry {
  id: string;
  name: string;
  slug?: string | null;
  course_code?: string | null;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCompact(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '');
}

function tokenize(value: string) {
  return Array.from(
    new Set(
      normalize(value)
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  );
}

export function getSubjectDisplayLabel(subject: SubjectCatalogEntry) {
  return subject.course_code ? `${subject.name} / ${subject.course_code}` : subject.name;
}

function buildSearchableParts(subject: SubjectCatalogEntry) {
  const label = getSubjectDisplayLabel(subject);
  const searchableText = [
    subject.name,
    subject.slug ?? '',
    subject.course_code ?? '',
    label,
  ].join(' ');

  return {
    label,
    normalizedLabel: normalize(label),
    compactLabel: normalizeCompact(label),
    normalizedName: normalize(subject.name),
    compactName: normalizeCompact(subject.name),
    normalizedSlug: normalize(subject.slug ?? ''),
    compactSlug: normalizeCompact(subject.slug ?? ''),
    normalizedCourseCode: normalize(subject.course_code ?? ''),
    compactCourseCode: normalizeCompact(subject.course_code ?? ''),
    tokens: tokenize(searchableText),
  };
}

function scoreSubjectMatch(subject: SubjectCatalogEntry, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return 1;
  }

  const compactQuery = normalizeCompact(query);
  const queryTokens = tokenize(query);
  const parts = buildSearchableParts(subject);

  let score = 0;

  if (
    parts.normalizedName === normalizedQuery ||
    parts.normalizedCourseCode === normalizedQuery ||
    parts.normalizedLabel === normalizedQuery ||
    parts.normalizedSlug === normalizedQuery
  ) {
    score += 500;
  }

  if (
    parts.compactName === compactQuery ||
    parts.compactCourseCode === compactQuery ||
    parts.compactLabel === compactQuery ||
    parts.compactSlug === compactQuery
  ) {
    score += 420;
  }

  if (parts.normalizedName.startsWith(normalizedQuery)) {
    score += 240;
  }

  if (parts.normalizedCourseCode.startsWith(normalizedQuery)) {
    score += 220;
  }

  if (parts.normalizedLabel.startsWith(normalizedQuery)) {
    score += 200;
  }

  if (
    parts.normalizedName.includes(normalizedQuery) ||
    parts.normalizedCourseCode.includes(normalizedQuery) ||
    parts.normalizedLabel.includes(normalizedQuery) ||
    parts.normalizedSlug.includes(normalizedQuery)
  ) {
    score += 120;
  }

  if (
    parts.compactName.includes(compactQuery) ||
    parts.compactCourseCode.includes(compactQuery) ||
    parts.compactLabel.includes(compactQuery) ||
    parts.compactSlug.includes(compactQuery)
  ) {
    score += 90;
  }

  let unmatchedTokenCount = 0;
  for (const token of queryTokens) {
    const tokenMatched = parts.tokens.some((candidate) => candidate.startsWith(token) || candidate.includes(token));
    if (!tokenMatched) {
      unmatchedTokenCount += 1;
      continue;
    }

    if (parts.tokens.some((candidate) => candidate === token)) {
      score += 90;
    } else if (parts.tokens.some((candidate) => candidate.startsWith(token))) {
      score += 60;
    } else {
      score += 35;
    }
  }

  if (queryTokens.length > 0 && unmatchedTokenCount === queryTokens.length) {
    return Number.NEGATIVE_INFINITY;
  }

  return score;
}

export function getSubjectSuggestions(subjects: SubjectCatalogEntry[], query: string, limit = 8) {
  if (!query.trim()) {
    return [...subjects]
      .sort((left, right) => getSubjectDisplayLabel(left).localeCompare(getSubjectDisplayLabel(right)))
      .slice(0, limit);
  }

  return subjects
    .map((subject) => ({
      subject,
      score: scoreSubjectMatch(subject, query),
    }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        getSubjectDisplayLabel(left.subject).localeCompare(getSubjectDisplayLabel(right.subject)),
    )
    .slice(0, limit)
    .map((entry) => entry.subject);
}
