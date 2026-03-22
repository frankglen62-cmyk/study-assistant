import { describe, expect, it } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

describe('question text equivalence', () => {
  it('treats fill-in-the-blank prompts as equivalent even when blank markers differ', async () => {
    const { isQuestionTextEquivalent } = await import('@/lib/ai/choice-matching');

    expect(
      isQuestionTextEquivalent(
        'The ___ Layer describes the notion that access to end-user applications have to be constrained to business ought-to-know.',
        'The __ Layer describes the notion that access to end-user applications have to be constrained to business ought-to-know.',
      ),
    ).toBe(true);
  });

  it('treats punctuation-only blank differences as equivalent', async () => {
    const { isQuestionTextEquivalent } = await import('@/lib/ai/choice-matching');

    expect(
      isQuestionTextEquivalent(
        'CIA stands for ___, integrity, and availability and these are the three main objectives of information security.',
        'CIA stands for , integrity, and availability and these are the three main objectives of information security.',
      ),
    ).toBe(true);
  });
});

describe('choice matching', () => {
  it('prefers question text with the same blank-marker structure', async () => {
    const { scoreBlankStructureAlignment } = await import('@/lib/ai/choice-matching');

    expect(
      scoreBlankStructureAlignment(
        'The unit of POWER is __________?',
        'The unit of POWER is __________?',
      ),
    ).toBeGreaterThan(
      scoreBlankStructureAlignment(
        'The unit of POWER is __________?',
        'The unit of POWER is ?',
      ),
    );
  });

  it('ignores LMS control text like clear my choice when resolving an option', async () => {
    const { resolveSuggestedOption } = await import('@/lib/ai/choice-matching');

    expect(
      resolveSuggestedOption(
        ['Positive', 'Negative', 'Clear my choice'],
        'Positive, Negative',
        'The 2 kinds of charge are ?',
      ),
    ).toBe(null);
  });

  it('does not collapse multi-answer checkbox text into a single option', async () => {
    const { resolveSuggestedOption } = await import('@/lib/ai/choice-matching');

    expect(
      resolveSuggestedOption(
        ['Positive', 'Negative'],
        'Positive, Negative',
        'The 2 kinds of charge are ?',
      ),
    ).toBe(null);
  });
});
