/* ────────────────────────────────────────────────────────────────────
 *  Dropdown Pairs — Parsing & Serialization (client-safe)
 *
 *  When a Q&A pair has question_type='dropdown', the answer_text field
 *  uses a structured format to store multiple sub-question / answer pairs:
 *
 *    ##DROPDOWN_PAIRS##
 *    sub_prompt_1 ||| answer_1
 *    sub_prompt_2 ||| answer_2
 *    ...
 *
 *  This file is intentionally free of server-only imports so it can be
 *  used in both server code and client components (e.g. admin UI).
 * ──────────────────────────────────────────────────────────────────── */

export const DROPDOWN_PAIRS_HEADER = '##DROPDOWN_PAIRS##';

export interface DropdownPair {
  subPrompt: string;
  answer: string;
}

/**
 * Parse dropdown sub-question/answer pairs from the answer_text field.
 * Returns null if the text doesn't use the dropdown pairs format.
 */
export function parseDropdownPairs(answerText: string): DropdownPair[] | null {
  const trimmed = answerText.trim();
  if (!trimmed.startsWith(DROPDOWN_PAIRS_HEADER)) {
    return null;
  }

  const lines = trimmed
    .slice(DROPDOWN_PAIRS_HEADER.length)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('|||'));

  if (lines.length === 0) {
    return null;
  }

  return lines.map((line) => {
    const separatorIndex = line.indexOf('|||');
    return {
      subPrompt: line.slice(0, separatorIndex).trim(),
      answer: line.slice(separatorIndex + 3).trim(),
    };
  });
}

/**
 * Serialize dropdown pairs back into the answer_text format.
 */
export function serializeDropdownPairs(pairs: DropdownPair[]): string {
  if (pairs.length === 0) {
    return '';
  }

  // Keep ALL pairs (including incomplete ones) so the editor doesn't
  // reset fields while the user is still typing.
  const lines = pairs.map((p) => `${p.subPrompt} ||| ${p.answer}`);

  return `${DROPDOWN_PAIRS_HEADER}\n${lines.join('\n')}`;
}

/**
 * Like serializeDropdownPairs but strips empty/incomplete pairs.
 * Use this when saving to the database.
 */
export function serializeDropdownPairsForSave(pairs: DropdownPair[]): string {
  const validPairs = pairs.filter((p) => p.subPrompt.trim() && p.answer.trim());
  if (validPairs.length === 0) {
    return '';
  }

  const lines = validPairs.map((p) => `${p.subPrompt.trim()} ||| ${p.answer.trim()}`);
  return `${DROPDOWN_PAIRS_HEADER}\n${lines.join('\n')}`;
}
