import { describe, expect, it } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

describe('buildQaPairAnswerSuggestion', () => {
  it('keeps the choice letter when the correct answer appears in labeled options', async () => {
    const { buildQaPairAnswerSuggestion } = await import('@/lib/ai/answering');
    const result = buildQaPairAnswerSuggestion({
      pair: {
        id: 'qa-1',
        subject_id: 'subject-1',
        category_id: null,
        question_text: 'Which translation is also called the Authorized Version?',
        answer_text: 'Authorized Version',
        short_explanation: null,
        keywords: [],
        sort_order: 1,
        similarity: 0.98,
        subject_name: 'Pagsasaling Pampanitikan',
        category_name: 'Quiz',
      },
      options: ['A. Jerusalem Bible', 'B. New International Version', 'D. Authorized Version'],
      subjectName: 'Pagsasaling Pampanitikan',
      categoryName: 'Quiz',
    });

    expect(result.suggestedOption).toBe('D. Authorized Version');
  });

  it('returns the correct true or false option when the stored answer is boolean', async () => {
    const { buildQaPairAnswerSuggestion } = await import('@/lib/ai/answering');
    const result = buildQaPairAnswerSuggestion({
      pair: {
        id: 'qa-2',
        subject_id: 'subject-1',
        category_id: null,
        question_text: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
        answer_text: 'TRUE',
        short_explanation: null,
        keywords: [],
        sort_order: 2,
        similarity: 0.99,
        subject_name: 'Pagsasaling Pampanitikan',
        category_name: 'Quiz',
      },
      options: ['True', 'False'],
      subjectName: 'Pagsasaling Pampanitikan',
      categoryName: 'Quiz',
    });

    expect(result.suggestedOption).toBe('True');
  });
});
