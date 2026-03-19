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
