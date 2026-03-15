import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test-env';

setTestEnv();

const catalogMocks = vi.hoisted(() => ({
  getActiveCatalog: vi.fn(),
}));

const detectionMocks = vi.hoisted(() => ({
  detectSubjectCategory: vi.fn(),
}));

const extractionMocks = vi.hoisted(() => ({
  extractQuestionContext: vi.fn(),
}));

const retrievalMocks = vi.hoisted(() => ({
  retrieveRelevantChunks: vi.fn(),
  retrieveRelevantQaPairs: vi.fn(),
  retrieveRelevantQaPairsAcrossSubjects: vi.fn(),
}));

const answerMocks = vi.hoisted(() => ({
  generateAnswerSuggestion: vi.fn(),
  buildQaPairAnswerSuggestion: vi.fn(),
}));

const walletMocks = vi.hoisted(() => ({
  applyWalletSeconds: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  createQuestionAttempt: vi.fn(),
  syncSessionAfterAnalysis: vi.fn(),
}));

vi.mock('@/lib/supabase/catalog', () => catalogMocks);
vi.mock('@/lib/ai/detection', () => detectionMocks);
vi.mock('@/lib/ai/extraction', () => extractionMocks);
vi.mock('@/lib/ai/retrieval', () => retrievalMocks);
vi.mock('@/lib/ai/answering', () => answerMocks);
vi.mock('@/lib/billing/wallet', () => walletMocks);
vi.mock('@/lib/supabase/sessions', () => sessionMocks);
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }));

describe('analyze service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns suggestion-only output and does not expose raw chunk text', async () => {
    catalogMocks.getActiveCatalog.mockResolvedValue({ subjects: [], categories: [] });
    detectionMocks.detectSubjectCategory.mockResolvedValue({
      subject: { id: 'subject-1', name: 'Physics' },
      category: { id: 'category-1', name: 'Midterm' },
      subjectConfidence: 0.9,
      categoryConfidence: 0.85,
      detectionMode: 'auto',
      warning: null,
      reasoning: 'Matched by course code.',
    });
    extractionMocks.extractQuestionContext.mockResolvedValue({
      questionText: 'What is force?',
      options: ['Mass times acceleration'],
      answerType: 'multiple_choice',
    });
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue({
      chunks: [
        {
          text_content: 'Force equals mass times acceleration.',
          source_title: 'Physics Reviewer',
          heading: 'Dynamics',
          similarity: 0.91,
        },
      ],
      retrievalConfidence: 0.91,
      retrievalStatus: 'Searched 1 chunk in Physics / Midterm.',
    });
    retrievalMocks.retrieveRelevantQaPairs.mockResolvedValue({
      pairs: [],
      retrievalConfidence: null,
      retrievalStatus: 'No matching subject answer pairs were found for Physics / Midterm.',
    });
    retrievalMocks.retrieveRelevantQaPairsAcrossSubjects.mockResolvedValue({
      pairs: [],
      retrievalConfidence: null,
      retrievalStatus: 'No matching answer pairs were found across subject folders.',
    });
    walletMocks.applyWalletSeconds.mockResolvedValue({
      remaining_seconds: 3540,
    });

    const { analyzeStudyPage } = await import('@/lib/ai/analyze');
    const result = await analyzeStudyPage({
      userId: 'user-1',
      sessionId: 'session-1',
      request: {
        mode: 'analyze',
        pageSignals: {
          pageUrl: 'https://lms.example.com/physics',
          pageDomain: 'lms.example.com',
          pageTitle: 'Physics Midterm',
          headings: ['Question 1'],
          breadcrumbs: ['Physics'],
          visibleLabels: ['A'],
          visibleTextExcerpt: 'What is force?',
          questionText: 'What is force?',
          options: ['Mass times acceleration'],
          questionCandidates: [
            {
              id: 'question-1',
              prompt: 'What is force?',
              options: ['Mass times acceleration'],
              contextLabel: null,
            },
          ],
          courseCodes: ['PHY101'],
          extractedAt: new Date().toISOString(),
        },
        screenshotDataUrl: null,
        manualSubject: '',
        manualCategory: '',
        sessionId: 'session-1',
        liveAssist: false,
      },
    });

    expect(result.answerText).toBe('Mass times acceleration');
    expect(result.shortExplanation).toContain('supports this option');
    expect(result.questionSuggestions).toHaveLength(1);
    expect(result.questionSuggestions[0]?.suggestedOption).toBe('Mass times acceleration');
    expect(result.detectedSubject).toBe('Physics');
    expect(result.sourceSubject).toBe('Physics');
    expect(result.sourceScope).toBe('file_sources');
    expect(result.searchScope).toBe('subject_first');
    expect(result.fallbackApplied).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Force equals mass times acceleration.');
    expect(answerMocks.generateAnswerSuggestion).not.toHaveBeenCalled();
    expect(walletMocks.applyWalletSeconds).toHaveBeenCalledOnce();
  });

  it('prefers stored subject Q&A pairs before chunk retrieval', async () => {
    catalogMocks.getActiveCatalog.mockResolvedValue({ subjects: [], categories: [] });
    detectionMocks.detectSubjectCategory.mockResolvedValue({
      subject: { id: 'subject-1', name: 'Physics' },
      category: { id: 'category-1', name: 'Quiz' },
      subjectConfidence: 0.88,
      categoryConfidence: 0.8,
      detectionMode: 'auto',
      warning: null,
      reasoning: 'Matched quiz subject signals.',
    });
    extractionMocks.extractQuestionContext.mockResolvedValue({
      questionText: 'Volts is the unit for current.',
      options: ['True', 'False'],
      answerType: 'multiple_choice',
    });
    retrievalMocks.retrieveRelevantQaPairs.mockResolvedValue({
      pairs: [
        {
          id: 'qa-1',
          subject_id: 'subject-1',
          category_id: 'category-1',
          question_text: 'Volts is the unit for current.',
          answer_text: 'False',
          short_explanation: 'Current is measured in amperes, while volts measure electric potential difference.',
          keywords: ['volts', 'current', 'amperes'],
          sort_order: 0,
          similarity: 0.94,
          subject_name: 'Physics',
          category_name: 'Quiz',
        },
      ],
      retrievalConfidence: 0.94,
      retrievalStatus: 'Matched 1 stored answer pair in Physics / Quiz.',
    });
    retrievalMocks.retrieveRelevantQaPairsAcrossSubjects.mockResolvedValue({
      pairs: [],
      retrievalConfidence: null,
      retrievalStatus: 'No matching answer pairs were found across subject folders.',
    });
    answerMocks.buildQaPairAnswerSuggestion.mockReturnValue({
      answerText: 'False',
      shortExplanation: 'Current is measured in amperes, while volts measure electric potential difference.',
      suggestedOption: 'False',
      confidence: 0.95,
      warning: null,
    });
    walletMocks.applyWalletSeconds.mockResolvedValue({
      remaining_seconds: 3480,
    });

    const { analyzeStudyPage } = await import('@/lib/ai/analyze');
    const result = await analyzeStudyPage({
      userId: 'user-1',
      sessionId: 'session-1',
      request: {
        mode: 'analyze',
        pageSignals: {
          pageUrl: 'https://quiz.example.com/physics',
          pageDomain: 'quiz.example.com',
          pageTitle: 'Physics Quiz',
          headings: ['Question 1'],
          breadcrumbs: ['Physics'],
          visibleLabels: ['True', 'False'],
          visibleTextExcerpt: 'Volts is the unit for current.',
          questionText: 'Volts is the unit for current.',
          options: ['True', 'False'],
          questionCandidates: [
            {
              id: 'question-1',
              prompt: 'Volts is the unit for current.',
              options: ['True', 'False'],
              contextLabel: null,
            },
          ],
          courseCodes: ['PHY101'],
          extractedAt: new Date().toISOString(),
        },
        screenshotDataUrl: null,
        manualSubject: '',
        manualCategory: '',
        sessionId: 'session-1',
        liveAssist: false,
      },
    });

    expect(result.answerText).toBe('False');
    expect(result.suggestedOption).toBe('False');
    expect(result.detectedSubject).toBe('Physics');
    expect(result.sourceSubject).toBe('Physics');
    expect(result.sourceScope).toBe('subject_folder');
    expect(result.searchScope).toBe('subject_first');
    expect(result.fallbackApplied).toBe(false);
    expect(retrievalMocks.retrieveRelevantChunks).not.toHaveBeenCalled();
    expect(answerMocks.generateAnswerSuggestion).not.toHaveBeenCalled();
    expect(answerMocks.buildQaPairAnswerSuggestion).toHaveBeenCalled();
  });

  it('falls back to all subject folders when the detected subject has no direct match', async () => {
    catalogMocks.getActiveCatalog.mockResolvedValue({ subjects: [], categories: [] });
    detectionMocks.detectSubjectCategory.mockResolvedValue({
      subject: { id: 'subject-1', name: 'Calculus-Based Physics 2' },
      category: { id: 'category-1', name: 'Quiz' },
      subjectConfidence: 0.86,
      categoryConfidence: 0.79,
      detectionMode: 'auto',
      warning: null,
      reasoning: 'Matched subject from course code.',
    });
    extractionMocks.extractQuestionContext.mockResolvedValue({
      questionText: 'What is software engineering?',
      options: [],
      answerType: 'short_answer',
    });
    retrievalMocks.retrieveRelevantQaPairs.mockResolvedValue({
      pairs: [],
      retrievalConfidence: null,
      retrievalStatus: 'No matching subject answer pairs were found for Calculus-Based Physics 2 / Quiz.',
    });
    retrievalMocks.retrieveRelevantQaPairsAcrossSubjects.mockResolvedValue({
      pairs: [
        {
          id: 'qa-2',
          subject_id: 'subject-2',
          category_id: null,
          question_text: 'What is software engineering?',
          answer_text: 'Software engineering is the systematic application of engineering principles to software development.',
          short_explanation: 'Matched a stored Q&A pair from Software Engineering 1.',
          keywords: ['software', 'engineering'],
          sort_order: 1,
          similarity: 0.91,
          subject_name: 'Software Engineering 1',
          category_name: null,
        },
      ],
      retrievalConfidence: 0.91,
      retrievalStatus: 'Matched 1 stored answer pair across subject folders.',
    });
    answerMocks.buildQaPairAnswerSuggestion.mockReturnValue({
      answerText: 'Software engineering is the systematic application of engineering principles to software development.',
      shortExplanation: 'Matched a stored Q&A pair from Software Engineering 1.',
      suggestedOption: null,
      confidence: 0.93,
      warning: null,
    });
    walletMocks.applyWalletSeconds.mockResolvedValue({
      remaining_seconds: 3420,
    });

    const { analyzeStudyPage } = await import('@/lib/ai/analyze');
    const result = await analyzeStudyPage({
      userId: 'user-1',
      sessionId: 'session-1',
      request: {
        mode: 'analyze',
        pageSignals: {
          pageUrl: 'https://quiz.example.com/cross-subject',
          pageDomain: 'quiz.example.com',
          pageTitle: 'Cross Subject Quiz',
          headings: ['Question 1'],
          breadcrumbs: ['General'],
          visibleLabels: [],
          visibleTextExcerpt: 'What is software engineering?',
          questionText: 'What is software engineering?',
          options: [],
          questionCandidates: [
            {
              id: 'question-1',
              prompt: 'What is software engineering?',
              options: [],
              contextLabel: null,
            },
          ],
          courseCodes: ['NSCI6101'],
          extractedAt: new Date().toISOString(),
        },
        screenshotDataUrl: null,
        manualSubject: '',
        manualCategory: '',
        sessionId: 'session-1',
        liveAssist: false,
        searchScope: 'subject_first',
      },
    });

    expect(result.answerText).toContain('systematic application');
    expect(result.detectedSubject).toBe('Calculus-Based Physics 2');
    expect(result.sourceSubject).toBe('Software Engineering 1');
    expect(result.sourceScope).toBe('all_subject_folders');
    expect(result.searchScope).toBe('subject_first');
    expect(result.fallbackApplied).toBe(true);
    expect(retrievalMocks.retrieveRelevantChunks).not.toHaveBeenCalled();
  });

  it('supports explicit all-subject search mode', async () => {
    catalogMocks.getActiveCatalog.mockResolvedValue({ subjects: [], categories: [] });
    detectionMocks.detectSubjectCategory.mockResolvedValue({
      subject: { id: 'subject-1', name: 'Information Management' },
      category: null,
      subjectConfidence: 0.82,
      categoryConfidence: null,
      detectionMode: 'auto',
      warning: null,
      reasoning: 'Matched title and course code signals.',
    });
    extractionMocks.extractQuestionContext.mockResolvedValue({
      questionText: 'What does SDLC stand for?',
      options: [],
      answerType: 'short_answer',
    });
    retrievalMocks.retrieveRelevantQaPairsAcrossSubjects.mockResolvedValue({
      pairs: [
        {
          id: 'qa-3',
          subject_id: 'subject-3',
          category_id: null,
          question_text: 'What does SDLC stand for?',
          answer_text: 'Software Development Life Cycle',
          short_explanation: 'Matched across all subject folders.',
          keywords: ['sdlc'],
          sort_order: 1,
          similarity: 0.89,
          subject_name: 'Software Engineering 1',
          category_name: null,
        },
      ],
      retrievalConfidence: 0.89,
      retrievalStatus: 'Matched 1 stored answer pair across subject folders.',
    });
    answerMocks.buildQaPairAnswerSuggestion.mockReturnValue({
      answerText: 'Software Development Life Cycle',
      shortExplanation: 'Matched across all subject folders.',
      suggestedOption: null,
      confidence: 0.9,
      warning: null,
    });
    walletMocks.applyWalletSeconds.mockResolvedValue({
      remaining_seconds: 3360,
    });

    const { analyzeStudyPage } = await import('@/lib/ai/analyze');
    const result = await analyzeStudyPage({
      userId: 'user-1',
      sessionId: 'session-1',
      request: {
        mode: 'analyze',
        pageSignals: {
          pageUrl: 'https://quiz.example.com/general',
          pageDomain: 'quiz.example.com',
          pageTitle: 'General Quiz',
          headings: ['Question 1'],
          breadcrumbs: ['General'],
          visibleLabels: [],
          visibleTextExcerpt: 'What does SDLC stand for?',
          questionText: 'What does SDLC stand for?',
          options: [],
          questionCandidates: [
            {
              id: 'question-1',
              prompt: 'What does SDLC stand for?',
              options: [],
              contextLabel: null,
            },
          ],
          courseCodes: ['ITE6220'],
          extractedAt: new Date().toISOString(),
        },
        screenshotDataUrl: null,
        manualSubject: '',
        manualCategory: '',
        sessionId: 'session-1',
        liveAssist: false,
        searchScope: 'all_subjects',
      },
    });

    expect(result.answerText).toBe('Software Development Life Cycle');
    expect(result.detectedSubject).toBe('Information Management');
    expect(result.sourceSubject).toBe('Software Engineering 1');
    expect(result.sourceScope).toBe('all_subject_folders');
    expect(result.searchScope).toBe('all_subjects');
    expect(result.fallbackApplied).toBe(true);
    expect(retrievalMocks.retrieveRelevantQaPairs).not.toHaveBeenCalled();
  });

  it('returns up to 10 question suggestions for a visible 10-question page', async () => {
    const questionCandidates = Array.from({ length: 10 }, (_, index) => ({
      id: `question-${index + 1}`,
      prompt: `Question ${index + 1} prompt`,
      options: ['A. True', 'B. False'],
      contextLabel: null,
    }));

    catalogMocks.getActiveCatalog.mockResolvedValue({ subjects: [], categories: [] });
    detectionMocks.detectSubjectCategory.mockResolvedValue({
      subject: { id: 'subject-1', name: 'Pagsasaling Pampanitikan' },
      category: { id: 'category-1', name: 'Quiz' },
      subjectConfidence: 0.97,
      categoryConfidence: 0.88,
      detectionMode: 'auto',
      warning: null,
      reasoning: 'Matched subject from course code.',
    });
    extractionMocks.extractQuestionContext.mockResolvedValue({
      questionText: questionCandidates[0]?.prompt ?? null,
      options: questionCandidates[0]?.options ?? [],
      answerType: 'multiple_choice',
    });
    retrievalMocks.retrieveRelevantQaPairs.mockImplementation(async ({ queryText }: { queryText: string }) => ({
      pairs: [
        {
          id: `qa-${queryText}`,
          subject_id: 'subject-1',
          category_id: 'category-1',
          question_text: queryText,
          answer_text: 'TRUE',
          short_explanation: 'Matched exact question text.',
          keywords: [],
          sort_order: 0,
          similarity: 0.99,
          subject_name: 'Pagsasaling Pampanitikan',
          category_name: 'Quiz',
        },
      ],
      retrievalConfidence: 0.99,
      retrievalStatus: 'Matched 1 stored answer pair in Pagsasaling Pampanitikan / Quiz.',
    }));
    retrievalMocks.retrieveRelevantQaPairsAcrossSubjects.mockResolvedValue({
      pairs: [],
      retrievalConfidence: null,
      retrievalStatus: 'No matching answer pair was found across all subject folders.',
    });
    answerMocks.buildQaPairAnswerSuggestion.mockImplementation(({ pair }: { pair: { question_text: string } }) => ({
      answerText: 'TRUE',
      shortExplanation: `Matched ${pair.question_text}`,
      suggestedOption: 'A. True',
      confidence: 0.98,
      warning: null,
    }));
    walletMocks.applyWalletSeconds.mockResolvedValue({
      remaining_seconds: 3000,
    });

    const { analyzeStudyPage } = await import('@/lib/ai/analyze');
    const result = await analyzeStudyPage({
      userId: 'user-1',
      sessionId: 'session-1',
      request: {
        mode: 'analyze',
        pageSignals: {
          pageUrl: 'https://quiz.example.com/panitikan',
          pageDomain: 'quiz.example.com',
          pageTitle: 'Quiz 1',
          headings: ['Quiz 1'],
          breadcrumbs: ['Pagsasaling Pampanitikan'],
          visibleLabels: ['True', 'False'],
          visibleTextExcerpt: questionCandidates.map((candidate) => candidate.prompt).join(' '),
          questionText: questionCandidates[0]?.prompt ?? null,
          options: questionCandidates[0]?.options ?? [],
          questionCandidates,
          courseCodes: ['UGRD-FILI6301'],
          extractedAt: new Date().toISOString(),
        },
        screenshotDataUrl: null,
        manualSubject: '',
        manualCategory: '',
        sessionId: 'session-1',
        liveAssist: false,
        searchScope: 'subject_first',
      },
    });

    expect(result.questionSuggestions).toHaveLength(10);
    expect(result.questionSuggestions[9]?.questionId).toBe('question-10');
    expect(result.questionSuggestions[9]?.suggestedOption).toBe('A. True');
  });

  it('keeps the stored TRUE answer aligned to the visible True option for exact subject-folder matches', async () => {
    catalogMocks.getActiveCatalog.mockResolvedValue({ subjects: [], categories: [] });
    detectionMocks.detectSubjectCategory.mockResolvedValue({
      subject: { id: 'subject-1', name: 'Pagsasaling Pampanitikan' },
      category: { id: 'category-1', name: 'Quiz' },
      subjectConfidence: 0.98,
      categoryConfidence: 0.9,
      detectionMode: 'auto',
      warning: null,
      reasoning: 'Matched by course code and page text.',
    });
    extractionMocks.extractQuestionContext.mockResolvedValue({
      questionText: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
      options: ['True', 'False'],
      answerType: 'multiple_choice',
    });
    retrievalMocks.retrieveRelevantQaPairs.mockResolvedValue({
      pairs: [
        {
          id: 'qa-true-1',
          subject_id: 'subject-1',
          category_id: 'category-1',
          question_text: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
          answer_text: 'TRUE',
          short_explanation: 'Exact match from stored subject Q&A.',
          keywords: ['theodoro', 'mambabasa'],
          sort_order: 0,
          similarity: 0.99,
          subject_name: 'Pagsasaling Pampanitikan',
          category_name: 'Quiz',
        },
      ],
      retrievalConfidence: 0.99,
      retrievalStatus: 'Matched 1 stored answer pair in Pagsasaling Pampanitikan / Quiz.',
    });
    retrievalMocks.retrieveRelevantQaPairsAcrossSubjects.mockResolvedValue({
      pairs: [],
      retrievalConfidence: null,
      retrievalStatus: 'No matching answer pair was found across all subject folders.',
    });
    answerMocks.buildQaPairAnswerSuggestion.mockReturnValue({
      answerText: 'TRUE',
      shortExplanation: 'Exact match from stored subject Q&A.',
      suggestedOption: 'True',
      confidence: 0.98,
      warning: null,
    });
    walletMocks.applyWalletSeconds.mockResolvedValue({
      remaining_seconds: 2960,
    });

    const { analyzeStudyPage } = await import('@/lib/ai/analyze');
    const result = await analyzeStudyPage({
      userId: 'user-1',
      sessionId: 'session-1',
      request: {
        mode: 'analyze',
        pageSignals: {
          pageUrl: 'https://quiz.example.com/panitikan',
          pageDomain: 'quiz.example.com',
          pageTitle: 'Pagsasaling Quiz',
          headings: ['Question 8'],
          breadcrumbs: ['Pagsasaling Pampanitikan'],
          visibleLabels: ['True', 'False'],
          visibleTextExcerpt: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
          questionText: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
          options: ['True', 'False'],
          questionCandidates: [
            {
              id: 'question-8',
              prompt: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
              options: ['True', 'False'],
              contextLabel: 'Question 8',
            },
          ],
          courseCodes: ['UGRD-FILI6301'],
          extractedAt: new Date().toISOString(),
        },
        screenshotDataUrl: null,
        manualSubject: '',
        manualCategory: '',
        sessionId: 'session-1',
        liveAssist: false,
        searchScope: 'subject_first',
      },
    });

    expect(result.questionSuggestions).toHaveLength(1);
    expect(result.questionSuggestions[0]?.suggestedOption).toBe('True');
    expect(result.questionSuggestions[0]?.answerText).toBe('TRUE');
    expect(result.sourceSubject).toBe('Pagsasaling Pampanitikan');
    expect(result.sourceScope).toBe('subject_folder');
  });

  it('returns no match instead of picking a wrong boolean pair from a weakly similar question', async () => {
    catalogMocks.getActiveCatalog.mockResolvedValue({ subjects: [], categories: [] });
    detectionMocks.detectSubjectCategory.mockResolvedValue({
      subject: { id: 'subject-1', name: 'Pagsasaling Pampanitikan' },
      category: { id: 'category-1', name: 'Quiz' },
      subjectConfidence: 0.88,
      categoryConfidence: 0.82,
      detectionMode: 'auto',
      warning: null,
      reasoning: 'Matched subject from page context.',
    });
    extractionMocks.extractQuestionContext.mockResolvedValue({
      questionText: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
      options: ['True', 'False'],
      answerType: 'multiple_choice',
    });
    retrievalMocks.retrieveRelevantQaPairs.mockResolvedValue({
      pairs: [
        {
          id: 'qa-wrong-1',
          subject_id: 'subject-1',
          category_id: 'category-1',
          question_text: 'Kilala bilang isa sa haligi ng Translation Studies noong ika-20 siglo',
          answer_text: 'FALSE',
          short_explanation: null,
          keywords: ['translation', 'studies'],
          sort_order: 0,
          similarity: 0.74,
          subject_name: 'Pagsasaling Pampanitikan',
          category_name: 'Quiz',
        },
      ],
      retrievalConfidence: 0.74,
      retrievalStatus: 'Matched 1 stored answer pair in Pagsasaling Pampanitikan / Quiz.',
    });
    retrievalMocks.retrieveRelevantQaPairsAcrossSubjects.mockResolvedValue({
      pairs: [],
      retrievalConfidence: null,
      retrievalStatus: 'No matching answer pair was found across all subject folders.',
    });
    retrievalMocks.retrieveRelevantChunks.mockResolvedValue({
      chunks: [],
      retrievalConfidence: null,
      retrievalStatus: 'No matching active source chunks were found for Pagsasaling Pampanitikan / Quiz.',
    });
    walletMocks.applyWalletSeconds.mockResolvedValue({
      remaining_seconds: 2940,
    });

    const { analyzeStudyPage } = await import('@/lib/ai/analyze');
    const result = await analyzeStudyPage({
      userId: 'user-1',
      sessionId: 'session-1',
      request: {
        mode: 'analyze',
        pageSignals: {
          pageUrl: 'https://quiz.example.com/panitikan',
          pageDomain: 'quiz.example.com',
          pageTitle: 'Pagsasaling Quiz',
          headings: ['Question 8'],
          breadcrumbs: ['Pagsasaling Pampanitikan'],
          visibleLabels: ['True', 'False'],
          visibleTextExcerpt: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
          questionText: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
          options: ['True', 'False'],
          questionCandidates: [
            {
              id: 'question-8',
              prompt: 'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
              options: ['True', 'False'],
              contextLabel: 'Question 8',
            },
          ],
          courseCodes: ['UGRD-FILI6301'],
          extractedAt: new Date().toISOString(),
        },
        screenshotDataUrl: null,
        manualSubject: '',
        manualCategory: '',
        sessionId: 'session-1',
        liveAssist: false,
        searchScope: 'subject_first',
      },
    });

    expect(result.questionSuggestions).toHaveLength(1);
    expect(result.questionSuggestions[0]?.suggestedOption).toBeNull();
    expect(result.questionSuggestions[0]?.sourceScope).toBe('no_match');
    expect(result.questionSuggestions[0]?.warning).toContain('No matching source material was found');
  });
});
