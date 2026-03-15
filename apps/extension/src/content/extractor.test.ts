/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installExtractorContentScript } from './extractor';

interface MockChromeMessage {
  type?: string;
  payload?: unknown;
}

function createChromeMock() {
  const listeners: Array<(message: MockChromeMessage, sender: unknown, sendResponse: (value: unknown) => void) => void> =
    [];

  return {
    runtime: {
      onMessage: {
        addListener: vi.fn((listener) => {
          listeners.push(listener);
        }),
      },
      sendMessage: vi.fn(),
    },
    __listeners: listeners,
  };
}

function buildTrueFalseQuestionHtml(index: number) {
  return `
    <div class="que truefalse">
      <div class="info">
        <div class="no">Question ${index}</div>
      </div>
      <div class="content">
        <div class="formulation clearfix">
          <div class="prompt-text">Statement ${index} should keep its real prompt text.</div>
          <div class="ablock">
            <div class="prompt">Select one:</div>
            <div class="answer">
              <label for="q${index}_true"><input id="q${index}_true" type="radio" name="q${index}" /> True</label>
              <label for="q${index}_false"><input id="q${index}_false" type="radio" name="q${index}" /> False</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

describe('extension extractor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    document.title = 'Quiz Page';
    delete (window as Window & { __studyAssistantExtractorInstalled?: boolean }).__studyAssistantExtractorInstalled;
    delete (window as Window & { __studyAssistantLiveObserver?: MutationObserver | null }).__studyAssistantLiveObserver;
    delete (window as Window & { __studyAssistantLiveTimer?: number | null }).__studyAssistantLiveTimer;
    delete (window as Window & { __studyAssistantLastDigest?: string }).__studyAssistantLastDigest;
    vi.restoreAllMocks();
  });

  it('extracts all 10 visible LMS-style true/false questions with their real prompts', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <h1>Midterm Quiz 1</h1>
        ${Array.from({ length: 10 }, (_, index) => buildTrueFalseQuestionHtml(index + 1)).join('\n')}
      </main>
    `;

    Array.from(document.querySelectorAll<HTMLElement>('*')).forEach((element) => {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        width: 320,
        height: 48,
        top: 0,
        left: 0,
        right: 320,
        bottom: 48,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    installExtractorContentScript();

    const listener = chromeMock.__listeners[0];
    expect(listener).toBeTypeOf('function');

    let response: any = null;
    listener?.({ type: 'EXTENSION/EXTRACT_PAGE_SIGNALS' }, null, (value) => {
      response = value;
    });

    expect(response?.ok).toBe(true);
    expect(response?.data?.questionCandidates).toHaveLength(10);
    expect(response?.data?.diagnostics?.groupedInputCount).toBe(10);
    expect(response?.data?.diagnostics?.questionCandidateCount).toBe(10);
    expect(response?.data?.questionCandidates?.[0]?.prompt).toBe('Statement 1 should keep its real prompt text.');
    expect(response?.data?.questionCandidates?.[9]?.prompt).toBe('Statement 10 should keep its real prompt text.');
    expect(response?.data?.questionCandidates?.[0]?.options).toEqual(['True', 'False']);
    expect(response?.data?.questionText).toBe('Statement 1 should keep its real prompt text.');
  });

  it('does not collapse the prompt into question numbering or select-one boilerplate', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <article class="que multichoice">
          <aside class="info"><span class="no">Question 8</span></aside>
          <section class="content">
            <div class="formulation clearfix">
              <p>Ipinakilala ni theodoro ang tatlong uri ng mambabasa</p>
              <div class="ablock">
                <div class="prompt">Select one:</div>
                <div class="answer">
                  <label><input type="radio" name="q8" /> True</label>
                  <label><input type="radio" name="q8" /> False</label>
                </div>
              </div>
            </div>
          </section>
        </article>
      </main>
    `;

    Array.from(document.querySelectorAll<HTMLElement>('*')).forEach((element) => {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        width: 320,
        height: 48,
        top: 0,
        left: 0,
        right: 320,
        bottom: 48,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    installExtractorContentScript();

    const listener = chromeMock.__listeners[0];
    let response: any = null;
    listener?.({ type: 'EXTENSION/EXTRACT_PAGE_SIGNALS' }, null, (value) => {
      response = value;
    });

    expect(response?.ok).toBe(true);
    expect(response?.data?.questionCandidates).toHaveLength(1);
    expect(response?.data?.questionCandidates?.[0]?.prompt).toBe(
      'Ipinakilala ni theodoro ang tatlong uri ng mambabasa',
    );
    expect(response?.data?.questionCandidates?.[0]?.prompt).not.toContain('Question 8');
    expect(response?.data?.questionCandidates?.[0]?.prompt).not.toContain('Select one');
  });

  it('keeps separate question groups even when two visible prompts are identical', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <article class="que multichoice">
          <aside class="info"><span class="no">Question 1</span></aside>
          <section class="content">
            <div class="formulation clearfix">
              <p>Repeated prompt text</p>
              <div class="ablock">
                <div class="answer">
                  <label><input type="radio" name="q1" /> True</label>
                  <label><input type="radio" name="q1" /> False</label>
                </div>
              </div>
            </div>
          </section>
        </article>
        <article class="que multichoice">
          <aside class="info"><span class="no">Question 2</span></aside>
          <section class="content">
            <div class="formulation clearfix">
              <p>Repeated prompt text</p>
              <div class="ablock">
                <div class="answer">
                  <label><input type="radio" name="q2" /> True</label>
                  <label><input type="radio" name="q2" /> False</label>
                </div>
              </div>
            </div>
          </section>
        </article>
      </main>
    `;

    Array.from(document.querySelectorAll<HTMLElement>('*')).forEach((element) => {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        width: 320,
        height: 48,
        top: 0,
        left: 0,
        right: 320,
        bottom: 48,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    installExtractorContentScript();

    const listener = chromeMock.__listeners[0];
    let response: any = null;
    listener?.({ type: 'EXTENSION/EXTRACT_PAGE_SIGNALS' }, null, (value) => {
      response = value;
    });

    expect(response?.ok).toBe(true);
    expect(response?.data?.questionCandidates).toHaveLength(2);
    expect(response?.data?.questionCandidates?.[0]?.id).toBe('q1');
    expect(response?.data?.questionCandidates?.[1]?.id).toBe('q2');
  });

  it('extracts all 50 questions without truncation', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <h1>Final Exam</h1>
        ${Array.from({ length: 50 }, (_, index) => buildTrueFalseQuestionHtml(index + 1)).join('\n')}
      </main>
    `;

    // Use a prototype-level spy to avoid spying on each of ~1500 elements individually
    const originalGetBCR = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 320,
      height: 48,
      top: 0,
      left: 0,
      right: 320,
      bottom: 48,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    installExtractorContentScript();

    const listener = chromeMock.__listeners[0];
    let response: any = null;
    listener?.({ type: 'EXTENSION/EXTRACT_PAGE_SIGNALS' }, null, (value) => {
      response = value;
    });

    HTMLElement.prototype.getBoundingClientRect = originalGetBCR;

    expect(response?.ok).toBe(true);
    expect(response?.data?.questionCandidates).toHaveLength(50);
    expect(response?.data?.questionCandidates?.[0]?.prompt).toBe('Statement 1 should keep its real prompt text.');
    expect(response?.data?.questionCandidates?.[49]?.prompt).toBe('Statement 50 should keep its real prompt text.');
    expect(response?.data?.totalQuestionsDetected).toBe(50);
  }, 15000);

  it('detects quiz title and quiz number from page headings', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    // Set document.title to something without quiz keywords so the h1 is detected
    document.title = 'My Course Page';

    document.body.innerHTML = `
      <main>
        <h1>Midterm Quiz 3</h1>
        ${buildTrueFalseQuestionHtml(1)}
      </main>
    `;

    Array.from(document.querySelectorAll<HTMLElement>('*')).forEach((element) => {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        width: 320,
        height: 48,
        top: 0,
        left: 0,
        right: 320,
        bottom: 48,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    installExtractorContentScript();

    const listener = chromeMock.__listeners[0];
    let response: any = null;
    listener?.({ type: 'EXTENSION/EXTRACT_PAGE_SIGNALS' }, null, (value) => {
      response = value;
    });

    expect(response?.ok).toBe(true);
    expect(response?.data?.quizTitle).toBe('Midterm Quiz 3');
    expect(response?.data?.quizNumber).toBe('3');
    expect(response?.data?.totalQuestionsDetected).toBe(1);
  });
});
