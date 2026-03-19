import { setTestEnv } from '../test-env';

describe('subject detection', () => {
  beforeAll(() => {
    setTestEnv();
  });

  it('honors manual overrides without calling model classification', async () => {
    const { detectSubjectCategory } = await import('@/lib/ai/detection');

    const result = await detectSubjectCategory({
      subjects: [
        {
          id: '8da4f2bf-f831-4bba-8db4-6b36f1f8eb1a',
          name: 'Physics',
          slug: 'physics',
          course_code: 'PHY101',
          department: null,
          description: null,
          keywords: ['force', 'energy'],
          url_patterns: ['physics'],
          is_active: true,
        },
      ],
      categories: [
        {
          id: '117a2789-e117-4b90-a8c7-c9b744ba8a7e',
          subject_id: '8da4f2bf-f831-4bba-8db4-6b36f1f8eb1a',
          name: 'Midterm',
          slug: 'midterm',
          default_keywords: ['midterm'],
          is_active: true,
        },
      ],
      pageSignals: {
        pageUrl: 'https://lms.example.com/course/physics',
        pageDomain: 'lms.example.com',
        pageTitle: 'Physics quiz',
        headings: ['Physics quiz'],
        breadcrumbs: ['Courses', 'Physics'],
        visibleLabels: ['Question 1'],
        visibleTextExcerpt: 'Physics question about force and energy.',
        questionText: 'What is force?',
        options: ['Mass times acceleration', 'Energy over time'],
        questionCandidates: [
          {
            id: 'question-1',
            prompt: 'What is force?',
            options: ['Mass times acceleration', 'Energy over time'],
            contextLabel: null,
          },
        ],
        courseCodes: ['PHY101'],
        extractedAt: new Date().toISOString(),
      },
      manualSubject: 'Physics',
      manualCategory: 'Midterm',
      screenshotDataUrl: null,
    });

    expect(result.detectionMode).toBe('manual');
    expect(result.subject?.name).toBe('Physics');
    expect(result.category?.name).toBe('Midterm');
    expect(result.subjectConfidence).toBe(1);
  });

  it('does not keep a stale session subject lock when the current page clearly matches a different subject', async () => {
    const { detectSubjectCategory } = await import('@/lib/ai/detection');

    const result = await detectSubjectCategory({
      subjects: [
        {
          id: '8da4f2bf-f831-4bba-8db4-6b36f1f8eb1a',
          name: 'Physics',
          slug: 'physics',
          course_code: 'PHY101',
          department: null,
          description: null,
          keywords: ['force', 'energy'],
          url_patterns: ['physics'],
          is_active: true,
        },
        {
          id: '6f7d95ec-f503-4370-b708-af5db64ae4e2',
          name: 'Information Assurance and Security 2',
          slug: 'information-assurance-and-security-2',
          course_code: 'IT6206',
          department: null,
          description: null,
          keywords: ['cia', 'confidentiality', 'integrity', 'availability'],
          url_patterns: ['it6206', 'information-assurance'],
          is_active: true,
        },
      ],
      categories: [],
      pageSignals: {
        pageUrl: 'https://lms.example.com/course/it6206/final-exam',
        pageDomain: 'lms.example.com',
        pageTitle: 'UGRD-IT6206 Information Assurance and Security 2',
        headings: ['Final Examination'],
        breadcrumbs: ['Home', 'UGRD-IT6206-2522S'],
        visibleLabels: ['Question 33'],
        visibleTextExcerpt:
          'CIA stands for ___, integrity, and availability and these are the three main objectives of information security.',
        questionText:
          'CIA stands for ___, integrity, and availability and these are the three main objectives of information security.',
        options: [],
        questionCandidates: [
          {
            id: 'question-33',
            prompt:
              'CIA stands for ___, integrity, and availability and these are the three main objectives of information security.',
            options: [],
            contextLabel: 'Question 33',
          },
        ],
        courseCodes: ['IT6206'],
        extractedAt: new Date().toISOString(),
      },
      manualSubject: '',
      manualCategory: '',
      sessionSubjectId: '8da4f2bf-f831-4bba-8db4-6b36f1f8eb1a',
      sessionCategoryId: null,
      screenshotDataUrl: null,
    });

    expect(result.subject?.name).toBe('Information Assurance and Security 2');
    expect(result.reasoning).not.toContain('Session context remained aligned');
  });
});
