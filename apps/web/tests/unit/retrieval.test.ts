import { describe, expect, it } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

describe('qa pair ranking', () => {
  it('prefers the correct repeated job question when the salary and responsibilities match', async () => {
    const { rankQaPairRowsLocal } = await import('@/lib/ai/retrieval');

    const rows = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        subject_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        question_text:
          'What jobs in information security is this? Salary: $103,560 Responsibilities: Software developers can be tasked with a wide range of responsibilities that may include designing parts of computer programs and applications and designing how those pieces work together.',
        answer_text: 'Software Developer',
        short_explanation: null,
        keywords: [],
        sort_order: 88,
        updated_at: '2026-03-15T01:14:42.000Z',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        subject_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        question_text:
          'What jobs in information security is this? Salary: $104,000 Responsibilities: Create an in-office network for a small business or a cloud infrastructure for a business with corporate locations in cities on opposite coasts.',
        answer_text: 'Computer Network Architects',
        short_explanation: null,
        keywords: [],
        sort_order: 89,
        updated_at: '2026-03-15T01:14:42.000Z',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        subject_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        question_text:
          "What jobs in information security is this? Salary: $139,000 Responsibilities: Information systems managers work toward ensuring a company's tech is capable of meeting their IT goals.",
        answer_text: 'Computer and Information Systems Managers',
        short_explanation: null,
        keywords: [],
        sort_order: 90,
        updated_at: '2026-03-15T01:14:42.000Z',
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        subject_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        question_text:
          "What jobs in information security is this? Salary: $95,510 Responsibilities: Information security analysts monitor their companies' computer networks to combat hackers and compile reports of security breaches.",
        answer_text: 'Information Security Analyst',
        short_explanation: null,
        keywords: [],
        sort_order: 91,
        updated_at: '2026-03-15T01:14:42.000Z',
      },
    ];

    const ranked = rankQaPairRowsLocal({
      rows,
      queryText:
        'What jobs in information security is this? Salary: $104,000 Responsibilities: Create an in-office network for a small business or a cloud infrastructure for a business with corporate locations in cities on opposite coasts.',
      options: [],
      subjectNameFallback: 'Information Assurance and Security 2',
      categoryNameFallback: 'Midterm',
    });

    expect(ranked[0]?.answer_text).toBe('Computer Network Architects');
    expect(ranked[0]?.question_text).toContain('$104,000');
  });

  it('distinguishes repeated job questions by the 95,510 salary variant', async () => {
    const { rankQaPairRowsLocal } = await import('@/lib/ai/retrieval');

    const rows = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        subject_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        question_text:
          'What jobs in information security is this? Salary: $104,000 Responsibilities: Create an in-office network for a small business or a cloud infrastructure for a business with corporate locations in cities on opposite coasts.',
        answer_text: 'Computer Network Architects',
        short_explanation: null,
        keywords: [],
        sort_order: 89,
        updated_at: '2026-03-15T01:14:42.000Z',
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        subject_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        question_text:
          "What jobs in information security is this? Salary: $95,510 Responsibilities: Information security analysts monitor their companies' computer networks to combat hackers and compile reports of security breaches.",
        answer_text: 'Information Security Analyst',
        short_explanation: null,
        keywords: [],
        sort_order: 91,
        updated_at: '2026-03-15T01:14:42.000Z',
      },
    ];

    const ranked = rankQaPairRowsLocal({
      rows,
      queryText:
        "What jobs in information security is this? Salary: $95,510 Responsibilities: Information security analysts monitor their companies' computer networks to combat hackers and compile reports of security breaches.",
      options: [],
      subjectNameFallback: 'Information Assurance and Security 2',
      categoryNameFallback: 'Midterm',
    });

    expect(ranked[0]?.answer_text).toBe('Information Security Analyst');
    expect(ranked[0]?.question_text).toContain('$95,510');
  });

  it('prefers the category-specific exact match when a generic duplicate has a different valid option', async () => {
    const { rankQaPairRowsLocal } = await import('@/lib/ai/retrieval');

    const rows = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        subject_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: null,
        question_text: 'The unit of POWER is __________?',
        answer_text: 'WATTS',
        short_explanation: null,
        keywords: [],
        sort_order: 10,
        updated_at: '2026-03-22T10:00:00.000Z',
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        subject_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        question_text: 'The unit of POWER is __________?',
        answer_text: 'all of the above',
        short_explanation: null,
        keywords: [],
        sort_order: 278,
        updated_at: '2026-03-19T00:24:14.000Z',
      },
    ];

    const ranked = rankQaPairRowsLocal({
      rows,
      queryText: 'The unit of POWER is __________?',
      options: ['Watts', 'Horsepower', 'All of the above'],
      subjectNameFallback: 'Calculus-Based Physics 2',
      categoryNameFallback: 'Quiz',
    });

    expect(ranked[0]?.answer_text).toBe('all of the above');
    expect(ranked[0]?.category_id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });
});
