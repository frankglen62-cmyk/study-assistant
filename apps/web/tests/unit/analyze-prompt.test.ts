import { describe, expect, it } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

describe('short-form prompt enrichment', () => {
  it('reconstructs salary and responsibilities from visible page text', async () => {
    const { enrichShortFormPromptFromVisibleText } = await import('@/lib/ai/analyze');

    const enriched = enrichShortFormPromptFromVisibleText(
      'What jobs in information security is this?',
      [
        'Question 17',
        'What jobs in information security is this?',
        'Salary: $139,000',
        "Responsibilities: Information systems managers work toward ensuring a company's tech is capable of meeting their IT goals.",
        'Answer:',
        'Next page',
      ].join(' '),
    );

    expect(enriched).toContain('Salary: $139,000');
    expect(enriched).toContain("Responsibilities: Information systems managers work toward ensuring a company's tech is capable of meeting their IT goals.");
    expect(enriched).not.toContain('Answer:');
    expect(enriched).not.toContain('Next page');
  });
});
