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
});
