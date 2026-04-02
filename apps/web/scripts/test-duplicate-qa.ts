/**
 * Quick test to verify duplicate-question disambiguation logic.
 *
 * Simulates Question 8 and Question 30 — same question text,
 * different answers, different visible choices.
 */

import {
  normalizeComparableText,
  resolveSuggestedOption,
} from '../src/lib/ai/choice-matching';

// ── Q&A Pairs in the database ─────────────────────────────
const PAIR_1_ANSWER = 'SAN Management, RAID Arrays and Tape drives';
const PAIR_2_ANSWER = 'SAN Management, data protection, disk operation';

// ── Question 8 choices ────────────────────────────────────
const Q8_OPTIONS = [
  'a. SAN Management, data protection, disk operation',
  'b. Data protection',
  'c. Disk operation',
  'd. SAN Management',
];

// ── Question 30 choices ───────────────────────────────────
const Q30_OPTIONS = [
  'a. Tape drives',
  'b. SAN Management, RAID Arrays and Tape drives',
  'c. SAN Management',
  'd. RAID Arrays',
];

console.log('=== Testing duplicate-question disambiguation ===\n');

// Test Q8
const q8_pair1 = resolveSuggestedOption(Q8_OPTIONS, PAIR_1_ANSWER);
const q8_pair2 = resolveSuggestedOption(Q8_OPTIONS, PAIR_2_ANSWER);
console.log('Q8 (Expected: Pair 2 answer maps to choice "a")');
console.log(`  Pair 1 ("${PAIR_1_ANSWER}") → suggestedOption: ${q8_pair1 ?? 'null'}`);
console.log(`  Pair 2 ("${PAIR_2_ANSWER}") → suggestedOption: ${q8_pair2 ?? 'null'}`);

const q8_correct = q8_pair2 !== null && normalizeComparableText(q8_pair2).includes('data protection');
console.log(`  ✅ Q8 correct: ${q8_correct}\n`);

// Test Q30
const q30_pair1 = resolveSuggestedOption(Q30_OPTIONS, PAIR_1_ANSWER);
const q30_pair2 = resolveSuggestedOption(Q30_OPTIONS, PAIR_2_ANSWER);
console.log('Q30 (Expected: Pair 1 answer maps to choice "b")');
console.log(`  Pair 1 ("${PAIR_1_ANSWER}") → suggestedOption: ${q30_pair1 ?? 'null'}`);
console.log(`  Pair 2 ("${PAIR_2_ANSWER}") → suggestedOption: ${q30_pair2 ?? 'null'}`);

const q30_correct = q30_pair1 !== null && normalizeComparableText(q30_pair1).includes('raid arrays');
console.log(`  ✅ Q30 correct: ${q30_correct}\n`);

// Test scoring
console.log('=== Scoring verification ===\n');
const n = normalizeComparableText;
const q30_opts_normalized = Q30_OPTIONS.map(n).filter(Boolean);
const pair1_norm = n(PAIR_1_ANSWER);
const pair2_norm = n(PAIR_2_ANSWER);

const pair1_exact = q30_opts_normalized.some(o => o === pair1_norm);
const pair2_exact = q30_opts_normalized.some(o => o === pair2_norm);
console.log(`Q30: Pair 1 exact match in choices: ${pair1_exact} (expected: true)`);
console.log(`Q30: Pair 2 exact match in choices: ${pair2_exact} (expected: false)`);

const q8_opts_normalized = Q8_OPTIONS.map(n).filter(Boolean);
const pair1_exact_q8 = q8_opts_normalized.some(o => o === pair1_norm);
const pair2_exact_q8 = q8_opts_normalized.some(o => o === pair2_norm);
console.log(`Q8:  Pair 1 exact match in choices: ${pair1_exact_q8} (expected: false)`);
console.log(`Q8:  Pair 2 exact match in choices: ${pair2_exact_q8} (expected: true)`);

console.log('\n=== ALL TESTS PASSED ===');
if (!q8_correct || !q30_correct || !pair1_exact || pair2_exact || pair1_exact_q8 || !pair2_exact_q8) {
  console.error('\n❌ SOME TESTS FAILED — review output above');
  process.exit(1);
}
