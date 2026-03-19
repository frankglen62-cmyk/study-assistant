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
  }, 30000);

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

  it('preserves fill-in-the-blank placeholders inside visible prompt nodes', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 29</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">
                The <input type="text" name="q29:1_answer" value="Physical Access" /> Layer describes the notion that access to end-user applications have to be constrained to business ought-to-know.
              </div>
            </div>
          </div>
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
    expect(response?.data?.questionCandidates?.[0]?.prompt).toContain('___ Layer describes');
    expect(response?.data?.questionCandidates?.[0]?.prompt).not.toContain('Physical Access');
  });

  it('keeps salary and responsibility details with repeated short-form job questions', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 9</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">What jobs in information security is this?</div>
              <p>Salary: $104,000</p>
              <p>Responsibilities: Create an in-office network for a small business or a cloud infrastructure for a business with corporate locations in cities on opposite coasts.</p>
              <div class="ablock">
                <label for="q9-answer">Answer:</label>
                <input id="q9-answer" type="text" name="q9_answer" />
              </div>
            </div>
          </div>
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
    expect(response?.data?.questionCandidates?.[0]?.prompt).toContain('What jobs in information security is this?');
    expect(response?.data?.questionCandidates?.[0]?.prompt).toContain('Salary: $104,000');
    expect(response?.data?.questionCandidates?.[0]?.prompt).toContain('Responsibilities: Create an in-office network');
    expect(response?.data?.questionText).toContain('Salary: $104,000');
  });

  it('keeps salary and responsibility details when Moodle wraps the input in an answer block', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 28</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">What jobs in information security is this?</div>
              <p>Salary: $104,000</p>
              <p>Responsibilities: Create an in-office network for a small business or a cloud infrastructure for a business with corporate locations in cities on opposite coasts.</p>
              <div class="ablock">
                <div class="answer">
                  <label for="q28-answer">Answer:</label>
                  <input id="q28-answer" type="text" name="q28_answer" />
                </div>
              </div>
            </div>
          </div>
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
    expect(response?.data?.questionCandidates?.[0]?.prompt).toContain('What jobs in information security is this?');
    expect(response?.data?.questionCandidates?.[0]?.prompt).toContain('Salary: $104,000');
    expect(response?.data?.questionCandidates?.[0]?.prompt).toContain('Responsibilities: Create an in-office network');
    expect(response?.data?.questionCandidates?.[0]?.prompt).not.toContain('Answer:');
  });

  it('keeps separate prompts for multiple repeated short-answer job questions on one page', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 1</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">What jobs in information security is this?</div>
              <p>Salary: $103,560</p>
              <p>Responsibilities: Software developers can be tasked with a wide range of responsibilities that may include designing parts of computer programs and applications and designing how those pieces work together.</p>
              <div class="ablock">
                <label for="q1-answer">Answer:</label>
                <input id="q1-answer" type="text" name="q1_answer" />
              </div>
            </div>
          </div>
        </article>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 2</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">What jobs in information security is this?</div>
              <p>Salary: $104,000</p>
              <p>Responsibilities: Create an in-office network for a small business or a cloud infrastructure for a business with corporate locations in cities on opposite coasts.</p>
              <div class="ablock">
                <label for="q2-answer">Answer:</label>
                <input id="q2-answer" type="text" name="q2_answer" />
              </div>
            </div>
          </div>
        </article>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 3</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">What jobs in information security is this?</div>
              <p>Salary: $139,000</p>
              <p>Responsibilities: Information systems managers work toward ensuring a company's tech is capable of meeting their IT goals.</p>
              <div class="ablock">
                <label for="q3-answer">Answer:</label>
                <input id="q3-answer" type="text" name="q3_answer" />
              </div>
            </div>
          </div>
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
    expect(response?.data?.questionCandidates).toHaveLength(3);
    expect(response?.data?.questionCandidates?.[0]?.prompt).toContain('Salary: $103,560');
    expect(response?.data?.questionCandidates?.[1]?.prompt).toContain('Salary: $104,000');
    expect(response?.data?.questionCandidates?.[2]?.prompt).toContain('Salary: $139,000');
  });

  it('auto-fills the correct blank for each short-answer question on a multi-question page', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 1</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">Information is one of the most significant <input id="q1-answer" type="text" name="q1_answer" /> resources.</div>
            </div>
          </div>
        </article>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 2</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">Info security is concerned with making sure data in transit is protected by <input id="q2-answer" type="text" name="q2_answer" />.</div>
            </div>
          </div>
        </article>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 3</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">What jobs in information security is this?</div>
              <p>Salary: $95,510</p>
              <p>Responsibilities: Information security analysts monitor their companies' computer networks to combat hackers and compile reports of security breaches.</p>
              <div class="ablock">
                <label for="q3-answer">Answer:</label>
                <input id="q3-answer" type="text" name="q3_answer" />
              </div>
            </div>
          </div>
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
    let extractResponse: any = null;
    listener?.({ type: 'EXTENSION/EXTRACT_PAGE_SIGNALS' }, null, (value) => {
      extractResponse = value;
    });

    const questions = extractResponse?.data?.questionCandidates ?? [];
    expect(questions).toHaveLength(3);

    const answersBySalary = new Map<string, string>([
      ['q1_answer', 'non-substantial'],
      ['q2_answer', 'encryption'],
      ['q3_answer', 'Information Security Analyst'],
    ]);

    for (const question of questions) {
      listener?.(
        {
          type: 'EXTENSION/AUTO_CLICK_ANSWER',
          payload: {
            questionId: question.id,
            answerText: answersBySalary.get(question.id) ?? '',
            suggestedOption: null,
            options: [],
          },
        },
        null,
        () => {},
      );
    }

    expect((document.getElementById('q1-answer') as HTMLInputElement).value).toBe('non-substantial');
    expect((document.getElementById('q2-answer') as HTMLInputElement).value).toBe('encryption');
    expect((document.getElementById('q3-answer') as HTMLInputElement).value).toBe('Information Security Analyst');
  });

  it('auto-fills short-answer inputs and overwrites stale values', () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal('chrome', chromeMock);

    document.body.innerHTML = `
      <main>
        <article class="que shortanswer">
          <div class="info"><span class="no">Question 28</span></div>
          <div class="content">
            <div class="formulation clearfix">
              <div class="qtext">What jobs in information security is this?</div>
              <p>Salary: $104,000</p>
              <p>Responsibilities: Create an in-office network for a small business or a cloud infrastructure for a business with corporate locations in cities on opposite coasts.</p>
              <div class="ablock">
                <label for="q28-answer">Answer:</label>
                <input id="q28-answer" type="text" name="q28_answer" value="old answer" />
              </div>
            </div>
          </div>
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
    let extractResponse: any = null;
    listener?.({ type: 'EXTENSION/EXTRACT_PAGE_SIGNALS' }, null, (value) => {
      extractResponse = value;
    });

    const questionId = extractResponse?.data?.questionCandidates?.[0]?.id;
    expect(questionId).toBeTruthy();

    let autoClickResponse: any = null;
    listener?.(
      {
        type: 'EXTENSION/AUTO_CLICK_ANSWER',
        payload: {
          questionId,
          answerText: 'Computer Network Architects',
          suggestedOption: null,
          options: [],
        },
      },
      null,
      (value) => {
        autoClickResponse = value;
      },
    );

    expect(autoClickResponse?.ok).toBe(true);
    expect(autoClickResponse?.data?.clicked).toBe(true);
    expect(autoClickResponse?.data?.matchMethod).toBe('fill_in_blank');
    expect((document.getElementById('q28-answer') as HTMLInputElement).value).toBe('Computer Network Architects');
  });
});
