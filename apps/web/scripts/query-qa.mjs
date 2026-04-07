// Test that the fixed answers now produce correct multi-answer suggestions

function normalizeText(v) { return v.replace(/\s+/g, ' ').trim(); }
function normalizeComparableText(v) {
  return normalizeText(v)
    .replace(/^\s*[([]?([a-z]|\d{1,2}|[ivxlcdm]{1,5})[)\].:-]?\s+/iu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.,+\-%=_#*@]+/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}
function tokenize(v) { return normalizeComparableText(v).match(/[\p{L}\p{N}]+/gu) ?? []; }
function overlapScore(l, r) {
  const lt = new Set(tokenize(l)); if (!lt.size) return 0;
  const rt = new Set(tokenize(r)); let h = 0;
  for (const t of lt) if (rt.has(t)) h++;
  return h / lt.size;
}
function isIgnoredChoiceOption(v) {
  const c = normalizeText(v); if (!c) return true;
  return /^(?:clear my choice|flag question|check|not yet answered|not answered|answered|finish review|finish attempt|marked out of|mark \d+|marks?|submit|save|cancel|next page|previous page|time left|jump to|quiz navigation|response:?|your answer:?|answer:?|choose\.{0,3}|choose an option)$/i.test(c.toLowerCase());
}
function parseChoiceOption(o) {
  const c = normalizeText(o);
  const m = c.match(/^\s*[([]?([a-z]|\d{1,2}|[ivxlcdm]{1,5})[)\].:-]?\s+(.+)$/iu);
  const label = m?.[1] ? m[1].toUpperCase() : null;
  const text = normalizeText(m?.[2] ?? c);
  return { raw: c, label, text, normalizedRaw: normalizeComparableText(c), normalizedText: normalizeComparableText(text), display: label ? `${label}. ${text}` : c };
}
function scoreChoiceOption(params) {
  const na = normalizeComparableText(params.answerText); if (!na) return 0;
  if (params.option.normalizedText === na || params.option.normalizedRaw === na) return 1;
  if (params.option.normalizedText && (na.includes(params.option.normalizedText) || params.option.normalizedText.includes(na))) return 0.95;
  return Math.max(overlapScore(params.option.text, params.answerText), overlapScore(params.option.raw, params.answerText));
}
function splitMultiAnswerSegments(v) {
  const c = normalizeText(v); if (!c) return [];
  const s = c.split(/\s*(?:,|;|\/|\band\b|&|\+)\s*/i).map(x => normalizeText(x)).filter(x => x.length >= 2);
  if (s.length < 2 || s.length > 8) return [];
  return Array.from(new Set(s));
}

function resolveSuggestedOption(options, answerText, questionText) {
  const parsedOptions = options.filter(o => !isIgnoredChoiceOption(o)).map(parseChoiceOption).filter(o => !isIgnoredChoiceOption(o.raw) && Boolean(o.normalizedRaw));
  const na = normalizeComparableText(answerText);
  
  // Direct full match
  for (const o of parsedOptions) {
    if (o.normalizedText === na || o.normalizedRaw === na) return o.display;
  }
  // Near-exact containment
  for (const o of parsedOptions) {
    const s = Math.min(o.normalizedText.length, na.length), l = Math.max(o.normalizedText.length, na.length);
    if (s > 0 && l > 0 && s/l >= 0.85 && (o.normalizedText.includes(na) || na.includes(o.normalizedText))) return o.display;
  }
  // Multi-segment
  const ms = splitMultiAnswerSegments(answerText);
  if (ms.length >= 2) {
    const matched = ms.map(seg => {
      const best = parsedOptions.map(o => ({ display: o.display, score: scoreChoiceOption({ option: o, answerText: seg, questionText }) })).sort((a,b) => b.score - a.score)[0];
      return best && best.score >= 0.70 ? best.display : null;
    }).filter(Boolean);
    const distinct = Array.from(new Set(matched));
    if (distinct.length >= 2) return distinct.join(' | ');
  }
  // Contained fallback
  const contained = parsedOptions.filter(o => o.normalizedText.length > 3 && (na.includes(o.normalizedText) || answerText.toLowerCase().includes(o.text.toLowerCase())));
  if (contained.length >= 2) return contained.map(o => o.display).join(' | ');
  
  const best = parsedOptions.map(o => ({ option: o, score: scoreChoiceOption({ option: o, answerText, questionText }) })).sort((a,b) => b.score - a.score)[0];
  if (!best || best.score < 0.65) return null;
  return best.option.display;
}

// Test Q4 FIXED answer with comma delimiters
console.log('=== Q4: Evolution of Cloud Computing (FIXED) ===');
const q4 = resolveSuggestedOption(
  ['Cloud Computing', 'Cloud Service', 'Utility Computing', 'Grid Service', 'Parallel Computing', 'Software as a Service', 'Grid Computing', 'Utility Network'],
  'Grid Computing, Utility Computing, Cloud Computing, Software as a Service',
  'Evolution of Cloud Computing'
);
console.log('RESULT:', q4);
console.log('Multi-answer:', q4?.includes(' | ') ? '✅ YES' : '❌ NO');

// Test Q5 FIXED answer with comma delimiters
console.log('\n=== Q5: Enumerate the evolution (FIXED) ===');
const q5 = resolveSuggestedOption(
  ['Cloud Computing', 'Software as a Service', 'Grid Computing', 'Utility Computing'],
  'Software as a Service, Utility Computing, Cloud Computing, Grid Computing',
  'Enumerate the evolution of cloud computing.'
);
console.log('RESULT:', q5);
console.log('Multi-answer:', q5?.includes(' | ') ? '✅ YES' : '❌ NO');

// Test Q6 FIXED clean answer
console.log('\n=== Q6: Cloud Computing is a set of... (FIXED) ===');
const q6 = resolveSuggestedOption(
  ['service-oriented; elastic, cost-efficient, and on-demand.', 'self-oriented, elastic, cost-friendly, and on-demand.', 'service-oriented, flexible, cost-efficient, and on-demand.', 'self-oriented; flexible, cost-friendly, and on-demand.'],
  'service-oriented; elastic, cost-efficient, and on-demand.',
  'Cloud Computing is a set of architectures'
);
console.log('RESULT:', q6);
console.log('Single match:', q6 && !q6.includes(' | ') ? '✅ YES' : '❌ NO');
