import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const openAiMocks = vi.hoisted(() => ({
  createStructuredResponse: vi.fn(),
}));

vi.mock('@/lib/ai/openai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/openai')>('@/lib/ai/openai');
  return {
    ...actual,
    createStructuredResponse: openAiMocks.createStructuredResponse,
  };
});

describe('subject detection fast path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips model classification when the strongest subject has an exact course-code match', async () => {
    const { detectSubjectCategory } = await import('@/lib/ai/detection');

    const result = await detectSubjectCategory({
      subjects: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Information Assurance and Security 2',
          slug: 'information-assurance-and-security-2',
          course_code: 'IT6206',
          department: null,
          description: null,
          keywords: ['confidentiality', 'integrity', 'availability'],
          url_patterns: ['it6206', 'information-assurance'],
          is_active: true,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Computer Programming 2',
          slug: 'computer-programming-2',
          course_code: 'CS2202',
          department: null,
          description: null,
          keywords: ['loops', 'functions'],
          url_patterns: ['cs2202', 'programming'],
          is_active: true,
        },
      ],
      categories: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          subject_id: '11111111-1111-4111-8111-111111111111',
          name: 'Quiz',
          slug: 'quiz',
          default_keywords: ['quiz', 'attempt', 'review'],
          is_active: true,
        },
      ],
      pageSignals: {
        pageUrl: 'https://semestralexam.amaes.com/2522/mod/quiz/review.php?attempt=53863&cmid=5413&page=16',
        pageDomain: 'semestralexam.amaes.com',
        pageTitle: 'UGRD-IT6206 Information Assurance and Security 2',
        headings: ['Pre Final Lab Exam'],
        breadcrumbs: ['Home', 'UGRD-IT6206-2522S', 'Pre Final Examination'],
        visibleLabels: ['Question 17'],
        visibleTextExcerpt:
          "What jobs in information security is this? Salary: $139,000 Responsibilities: Information systems managers work toward ensuring a company's tech is capable of meeting their IT goals.",
        questionText:
          "What jobs in information security is this? Salary: $139,000 Responsibilities: Information systems managers work toward ensuring a company's tech is capable of meeting their IT goals.",
        options: [],
        questionCandidates: [
          {
            id: 'question-17',
            prompt:
              "What jobs in information security is this? Salary: $139,000 Responsibilities: Information systems managers work toward ensuring a company's tech is capable of meeting their IT goals.",
            options: [],
            contextLabel: 'Question 17',
          },
        ],
        diagnostics: {
          explicitQuestionBlockCount: 1,
          structuredQuestionBlockCount: 1,
          groupedInputCount: 1,
          promptCandidateCount: 1,
          questionCandidateCount: 1,
          visibleOptionCount: 0,
          courseCodeCount: 1,
        },
        courseCodes: ['IT6206'],
        extractedAt: new Date().toISOString(),
      },
      manualSubject: '',
      manualCategory: '',
      screenshotDataUrl: null,
    });

    expect(result.subject?.name).toBe('Information Assurance and Security 2');
    expect(result.reasoning).toContain('course-code match');
    expect(openAiMocks.createStructuredResponse).not.toHaveBeenCalled();
  });

  it('prefers the explicit LMS course heading before generic question keywords', async () => {
    const { detectSubjectCategory } = await import('@/lib/ai/detection');

    const result = await detectSubjectCategory({
      subjects: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Information Assurance and Security 2',
          slug: 'information-assurance-and-security-2',
          course_code: 'UGRD-IT6206',
          department: null,
          description: null,
          keywords: ['information security', 'confidentiality', 'integrity'],
          url_patterns: ['information-assurance', 'it6206'],
          is_active: true,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Information Management',
          slug: 'information-management',
          course_code: 'UGRD-ITE6220',
          department: null,
          description: null,
          keywords: ['management systems', 'data sets', 'employee number'],
          url_patterns: ['information-management', 'ite6220'],
          is_active: true,
        },
      ],
      categories: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          subject_id: '22222222-2222-4222-8222-222222222222',
          name: 'Quiz',
          slug: 'quiz',
          default_keywords: ['quiz', 'attempt', 'review'],
          is_active: true,
        },
      ],
      pageSignals: {
        pageUrl: 'https://semestralexam.amaes.com/2522/mod/quiz/attempt.php?attempt=999&cmid=5410&page=1',
        pageDomain: 'semestralexam.amaes.com',
        pageTitle: 'SEMESTRALEXAM 2522(PSCS) | UGRD-ITE6220 Information Management',
        headings: ['UGRD-ITE6220 Information Management', 'Prelim Exam'],
        breadcrumbs: ['Home', 'My courses', 'UGRD-ITE6220-2522S', 'Prelim Exam'],
        visibleLabels: ['Question 1'],
        visibleTextExcerpt: 'Management systems mimic human expertise to identify patterns in large data sets.',
        questionText: 'Management systems mimic human expertise to identify patterns in large data sets.',
        options: ['True', 'False'],
        questionCandidates: [
          {
            id: 'question-1',
            prompt: 'Management systems mimic human expertise to identify patterns in large data sets.',
            options: ['True', 'False'],
            contextLabel: 'Question 1',
          },
        ],
        diagnostics: {
          explicitQuestionBlockCount: 1,
          structuredQuestionBlockCount: 1,
          groupedInputCount: 1,
          promptCandidateCount: 1,
          questionCandidateCount: 1,
          visibleOptionCount: 2,
          courseCodeCount: 1,
        },
        courseCodes: ['UGRD-ITE6220'],
        extractedAt: new Date().toISOString(),
      },
      manualSubject: '',
      manualCategory: '',
      sessionSubjectId: '11111111-1111-4111-8111-111111111111',
      sessionCategoryId: null,
      screenshotDataUrl: null,
    });

    expect(result.subject?.name).toBe('Information Management');
    expect(result.reasoning).toContain('Page header');
    expect(openAiMocks.createStructuredResponse).not.toHaveBeenCalled();
  });
});
