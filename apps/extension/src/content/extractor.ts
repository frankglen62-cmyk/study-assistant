export function installExtractorContentScript() {
  const globalState = window as typeof window & {
    __studyAssistantExtractorInstalled?: boolean;
    __studyAssistantLiveObserver?: MutationObserver | null;
    __studyAssistantLiveTimer?: number | null;
    __studyAssistantLastDigest?: string;
  };

  if (globalState.__studyAssistantExtractorInstalled) {
    return;
  }

  globalState.__studyAssistantExtractorInstalled = true;
  globalState.__studyAssistantLiveObserver = null;
  globalState.__studyAssistantLiveTimer = null;
  globalState.__studyAssistantLastDigest = '';

  const courseCodePattern = /\b[A-Z]{2,10}(?:-[A-Z]{2,10})?\s*-?\s*\d{3,5}[A-Z]?\b/g;
  const MAX_VISIBLE_CONTEXT_ITEMS = 300;
  const MAX_EXTRACTED_OPTIONS = 50;
  const MAX_QUESTION_CANDIDATES = 5000;

  function isElementVisible(element: Element | null): boolean {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  function hasVisibleChoiceInputs(container: ParentNode | null): boolean {
    if (!container) {
      return false;
    }

    return Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]')).some((node) =>
      isElementVisible(node),
    );
  }

  function looksLikeQuestionNavigation(element: Element | null): boolean {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const className = normalizeText(element.className || '').toLowerCase();
    const text = normalizeText(element.textContent ?? '').toLowerCase();

    if (
      /(quiznav|quiz-navigation|navigationblock|qn_buttons|question-nav|question-navigation|navblock|mod_quiz_navblock)/i.test(
        className,
      )
    ) {
      return true;
    }

    if (text.length > 0 && text.length < 120 && /^(?:\d+\s*){4,}$/.test(text)) {
      return true;
    }

    return false;
  }

  function isBoilerplateQuestionText(value: string, optionLookup: Set<string>): boolean {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) {
      return true;
    }

    if (optionLookup.has(normalized)) {
      return true;
    }

    return (
      /^(question\s*\d+|select one:?|select one or more:?|true|false|yes|no)$/i.test(normalized) ||
      /^question\s*\d+\s*(select one:?|select one or more:?)?$/i.test(normalized) ||
      /^(complete|flag question|mark\b|answered|not answered|finish review)$/i.test(normalized)
    );
  }

  function collectTextNodeCandidates(container: ParentNode | null, optionLookup: Set<string>): string[] {
    if (!container) {
      return [];
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !isElementVisible(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        const text = normalizeText(node.textContent ?? '');
        if (text.length < 2 || text.length > 320) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const results: string[] = [];
    const seen = new Set<string>();

    while (walker.nextNode()) {
      const text = normalizeText(walker.currentNode.textContent ?? '');
      const key = text.toLowerCase();
      if (!text || seen.has(key) || isBoilerplateQuestionText(text, optionLookup)) {
        continue;
      }

      seen.add(key);
      results.push(text);
    }

    return results.slice(0, 1000);
  }

  function scorePromptCandidate(value: string, optionLookup: Set<string>): number {
    const normalized = normalizeText(value);
    const lower = normalized.toLowerCase();

    if (isBoilerplateQuestionText(normalized, optionLookup)) {
      return -100;
    }

    let score = 0;

    if (normalized.length >= 16 && normalized.length <= 220) {
      score += 3;
    }

    const wordCount = normalized.split(/\s+/).length;
    if (wordCount >= 4) {
      score += 2;
    }

    if (/[?.!]$/.test(normalized)) {
      score += 2;
    }

    if (
      /\b(which|what|why|how|true or false|must be|important|indicator|milestone|unit|voltage|current|resistance|charge|circuit|law)\b/i.test(
        lower,
      )
    ) {
      score += 4;
    }

    if (/question\s*\d+/i.test(lower) && normalized.length < 32) {
      score -= 5;
    }

    if (/select one/i.test(lower) && normalized.length < 40) {
      score -= 8;
    }

    if (optionLookup.has(lower)) {
      score -= 20;
    }

    return score;
  }

  function collectVisibleText(limit = 8000): string {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.parentElement || !isElementVisible(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }

        const text = normalizeText(node.textContent ?? '');
        if (!text || text.length < 2) {
          return NodeFilter.FILTER_REJECT;
        }

        const tagName = node.parentElement.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const parts: string[] = [];
    let currentLength = 0;

    while (walker.nextNode() && currentLength < limit) {
      const text = normalizeText(walker.currentNode.textContent ?? '');
      if (!text) {
        continue;
      }

      parts.push(text);
      currentLength += text.length;
    }

    return parts.join(' ').slice(0, limit);
  }

  function collectTexts(selector: string, limit = MAX_VISIBLE_CONTEXT_ITEMS): string[] {
    return Array.from(document.querySelectorAll(selector))
      .filter((node) => isElementVisible(node))
      .map((node) => normalizeText(node.textContent ?? ''))
      .filter(Boolean)
      .slice(0, limit);
  }

  function extractOptionLabel(input: Element): string {
    const id = input.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label && isElementVisible(label)) {
        return normalizeText(label.textContent ?? '');
      }
    }

    const wrapped = input.closest('label');
    return wrapped ? normalizeText(wrapped.textContent ?? '') : '';
  }

  function cleanOptionLabel(value: string): string {
    return normalizeText(value)
      .replace(/^\u2022\s*/, '')
      .trim();
  }

  function extractOptionsFromContainer(container: ParentNode | null, limit = MAX_EXTRACTED_OPTIONS): string[] {
    if (!container) {
      return [];
    }

    const fromInputs = Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]'))
      .map((input) => cleanOptionLabel(extractOptionLabel(input)))
      .filter(Boolean);

    const fromDataOptions = Array.from(container.querySelectorAll('[data-question-option], [role="option"], .option, .choice'))
      .filter((node) => isElementVisible(node))
      .map((node) => cleanOptionLabel(node.textContent ?? ''))
      .filter((text) => text.length > 2 && text.length < 180);

    const fromAnswerRows = Array.from(
      container.querySelectorAll('.answer label, .answer .r0, .answer .r1, .answer .r2, .answer .r3, .answer .flex-fill'),
    )
      .filter((node) => isElementVisible(node))
      .map((node) => cleanOptionLabel(node.textContent ?? ''))
      .filter((text) => text.length > 2 && text.length < 180);

    const fromListItems = Array.from(container.querySelectorAll('li'))
      .filter((node) => isElementVisible(node))
      .map((node) => cleanOptionLabel(node.textContent ?? ''))
      .filter((text) => /^[([]?[a-z0-9ivx]{1,5}[)\].:\s-]/i.test(text) || text.length < 180)
      .filter((text) => text.length > 2);

    return Array.from(new Set([...fromInputs, ...fromDataOptions, ...fromAnswerRows, ...fromListItems])).slice(0, limit);
  }

  function collectDetachedTextNodeCandidates(container: ParentNode | null, optionLookup: Set<string>): string[] {
    if (!container) {
      return [];
    }

    const ownerDocument = container instanceof Document ? container : container.ownerDocument ?? document;
    const walker = ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }

        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        const text = normalizeText(node.textContent ?? '');
        if (text.length < 2 || text.length > 320) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const results: string[] = [];
    const seen = new Set<string>();

    while (walker.nextNode()) {
      const text = normalizeText(walker.currentNode.textContent ?? '');
      const key = text.toLowerCase();
      if (!text || seen.has(key) || isBoilerplateQuestionText(text, optionLookup)) {
        continue;
      }

      seen.add(key);
      results.push(text);
    }

    return results.slice(0, 1000);
  }

  function derivePromptFromPrunedContainer(container: ParentNode | null): string | null {
    if (!(container instanceof HTMLElement)) {
      return null;
    }

    const optionLookup = new Set(
      extractOptionsFromContainer(container)
        .map((option) => normalizeText(option).toLowerCase())
        .filter(Boolean),
    );

    const clone = container.cloneNode(true);
    if (!(clone instanceof HTMLElement)) {
      return null;
    }

    clone
      .querySelectorAll(
        [
          '.answer',
          '.ablock',
          '.prompt',
          '.feedback',
          '.specificfeedback',
          '.generalfeedback',
          '.rightanswer',
          '.history',
          '.comment',
          '.controls',
          '.submitbtns',
          '.state',
          '.grade',
          '.info',
          '.qn_buttons',
          '.quiznav',
          '.question-nav',
          '.question-navigation',
          'input',
          'label',
          'button',
          'nav',
        ].join(', '),
      )
      .forEach((node) => node.remove());

    const promptCandidate = collectDetachedTextNodeCandidates(clone, optionLookup)
      .map((text) => ({
        text,
        score: scorePromptCandidate(text, optionLookup),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.text.length - right.text.length)[0];

    return promptCandidate?.text ?? null;
  }

  function deriveQuestionLabel(container: ParentNode | null): string | null {
    if (!container) {
      return null;
    }

    const labeledNode = container.querySelector(
      '.info .no, .question-number, .questionnumber, [class*="question-number"], [class*="questionnumber"], [data-question-label]',
    );
    if (labeledNode && isElementVisible(labeledNode)) {
      const text = normalizeText(labeledNode.textContent ?? '');
      if (/^question\s*\d+/i.test(text)) {
        return text;
      }
    }

    const candidates = collectTextNodeCandidates(container, new Set())
      .map((text) => normalizeText(text))
      .filter((text) => /^question\s*\d+/i.test(text));

    return candidates[0] ?? null;
  }

  function derivePromptFromContainer(container: ParentNode | null): string | null {
    if (!container) {
      return null;
    }

    const optionLookup = new Set(
      extractOptionsFromContainer(container)
        .map((option) => normalizeText(option).toLowerCase())
        .filter(Boolean),
    );

    const explicitPrompt = container.querySelector(
      [
        '[data-question-prompt]',
        '.qtext',
        '.questiontext',
        '.question-text',
        '.prompt',
        '.question-prompt',
        '.question-stem',
        '.stem',
        'legend',
      ].join(', '),
    );
    if (explicitPrompt && isElementVisible(explicitPrompt) && !looksLikeQuestionNavigation(explicitPrompt)) {
      const text = normalizeText(explicitPrompt.textContent ?? '');
      if (text.length >= 12 && !isBoilerplateQuestionText(text, optionLookup)) {
        return text.slice(0, 500);
      }
    }

    const prunedPrompt = derivePromptFromPrunedContainer(container);
    if (prunedPrompt) {
      return prunedPrompt.slice(0, 500);
    }

    const promptCandidate = collectTextNodeCandidates(container, optionLookup)
      .map((text) => ({
        text,
        score: scorePromptCandidate(text, optionLookup),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.text.length - right.text.length)[0];

    return promptCandidate?.text ?? null;
  }

  function findQuestionContainerForInputs(inputs: HTMLInputElement[]): ParentNode | null {
    const firstInput = inputs[0];
    if (!firstInput) {
      return null;
    }

    let current: HTMLElement | null = firstInput.parentElement;
    let bestContainer: HTMLElement | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const inputCount = inputs.length;

    while (current && current !== document.body) {
      if (isElementVisible(current) && inputs.every((input) => current?.contains(input))) {
        const visibleInputs = Array.from(current.querySelectorAll('input[type="radio"], input[type="checkbox"]')).filter((node) =>
          isElementVisible(node),
        ).length;
        const normalizedText = normalizeText(current.textContent ?? '');
        const prompt = derivePromptFromContainer(current);
        const optionCount = extractOptionsFromContainer(current).length;

        let score = 0;
        if (visibleInputs === inputCount) {
          score += 6;
        } else if (visibleInputs <= inputCount + 2) {
          score += 4;
        } else if (visibleInputs <= inputCount + 6) {
          score += 1;
        } else {
          score -= 4;
        }

        if (normalizedText.length >= 24 && normalizedText.length <= 900) {
          score += 2;
        }

        if (normalizedText.length > 1400) {
          score -= 3;
        }

        if (prompt) {
          score += 5;
        }

        if (current.matches('.que, .formulation, .content, [class*="question"], [id*="question"]')) {
          score += 4;
        }

        if (current.querySelector('.qtext, .questiontext, .question-text, .prompt, .question-prompt')) {
          score += 6;
        }

        if (optionCount >= 2) {
          score += 1;
        }

        if (score > bestScore) {
          bestScore = score;
          bestContainer = current;
        }
      }

      current = current.parentElement;
    }

    return (
      bestContainer ??
      firstInput.closest('[data-question-block], fieldset, [role="group"], .question, .quiz-question, article, section, form, div')
    );
  }

  function derivePromptNearInputs(inputs: HTMLInputElement[]): string | null {
    const firstInput = inputs[0];
    if (!firstInput) {
      return null;
    }

    const preferredContainer = firstInput.closest(
      '.que, .formulation, .content, [data-question-block], .question, .quiz-question, article, section',
    );
    if (preferredContainer instanceof HTMLElement) {
      const prompt = derivePromptFromContainer(preferredContainer);
      if (prompt) {
        return prompt;
      }
    }

    let current: HTMLElement | null = firstInput.parentElement;
    while (current && current !== document.body) {
      const previousPrompt = current.previousElementSibling;
      if (previousPrompt && isElementVisible(previousPrompt)) {
        const text = normalizeText(previousPrompt.textContent ?? '');
        if (text.length >= 12 && text.length <= 500) {
          return text;
        }
      }

      const parentPreviousPrompt = current.parentElement?.previousElementSibling;
      if (parentPreviousPrompt && isElementVisible(parentPreviousPrompt)) {
        const text = normalizeText(parentPreviousPrompt.textContent ?? '');
        if (text.length >= 12 && text.length <= 500) {
          return text;
        }
      }

      current = current.parentElement;
    }

    return null;
  }

  function resolveStructuredQuestionContainer(node: Element): HTMLElement | null {
    const container =
      node.closest(
        [
          '[data-question-block]',
          '.formulation',
          '.que',
          '.question',
          '.quiz-question',
          '[data-region="question"]',
          'fieldset',
          'article',
          'section',
          'div',
        ].join(', '),
      ) ?? null;

    if (!(container instanceof HTMLElement) || !isElementVisible(container) || looksLikeQuestionNavigation(container)) {
      return null;
    }

    if (!hasVisibleChoiceInputs(container) && extractOptionsFromContainer(container).length < 2) {
      return null;
    }

    return container;
  }

  function createQuestionCandidate(input: {
    id: string;
    prompt: string | null;
    options: string[];
    contextLabel?: string | null;
  }) {
    const prompt = normalizeText(input.prompt ?? '');
    const normalizedOptions = input.options.map((option) => normalizeText(option)).filter(Boolean);
    const minimumPromptLength = normalizedOptions.length >= 2 ? 8 : 12;
    if (prompt.length < minimumPromptLength) {
      return null;
    }

    return {
      id: input.id,
      prompt: prompt.slice(0, 500),
      options: normalizedOptions.slice(0, MAX_EXTRACTED_OPTIONS),
      contextLabel: input.contextLabel ? normalizeText(input.contextLabel).slice(0, 120) : null,
    };
  }

  function extractQuestionCandidates() {
    const candidates: Array<{
      id: string;
      prompt: string;
      options: string[];
      contextLabel: string | null;
    }> = [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const structuredContainers = new Set<string>();
    const visiblePromptNodes = Array.from(
      document.querySelectorAll(
        ['[data-question-prompt]', '.qtext', '.questiontext', '.question-text', '.prompt', '.question-prompt', '.question-stem', '.stem'].join(
          ', ',
        ),
      ),
    ).filter((node) => isElementVisible(node) && normalizeText(node.textContent ?? '').length >= 12);

    function pushCandidate(candidate: {
      id: string;
      prompt: string;
      options: string[];
      contextLabel: string | null;
    } | null) {
      if (!candidate) {
        return;
      }

      const normalizedId = normalizeText(candidate.id);
      if (normalizedId && seenIds.has(normalizedId)) {
        return;
      }

      if (normalizedId) {
        seenIds.add(normalizedId);
        candidates.push(candidate);
        return;
      }

      const key = `${candidate.prompt.toLowerCase()}::${candidate.options.join('|').toLowerCase()}`;
      if (seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      candidates.push(candidate);
    }

    visiblePromptNodes.forEach((node, index) => {
      const container = resolveStructuredQuestionContainer(node);
      if (!container) {
        return;
      }

      const prompt = normalizeText(node.textContent ?? '');
      if (isBoilerplateQuestionText(prompt, new Set())) {
        return;
      }

      const containerId = container.id || container.dataset.questionId || `structured-${index + 1}`;
      structuredContainers.add(containerId);
      container.dataset.studyAssistantId = containerId;

      pushCandidate(
        createQuestionCandidate({
          id: containerId,
          prompt,
          options: extractOptionsFromContainer(container),
          contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),
        }),
      );
    });

    const explicitQuestionBlocks = Array.from(document.querySelectorAll('[data-question-block]'))
      .filter((node) => isElementVisible(node))
      .filter((node) => !looksLikeQuestionNavigation(node));

    explicitQuestionBlocks.forEach((node, index) => {
        const element = node as HTMLElement;
        const id = element.dataset.questionId || `block-${index + 1}`;
        element.dataset.studyAssistantId = id;
        pushCandidate(
          createQuestionCandidate({
            id,
            prompt: derivePromptFromContainer(element),
            options: extractOptionsFromContainer(element),
            contextLabel: element.dataset.questionLabel ?? null,
          }),
        );
      });

    const groupedInputs = new Map<string, HTMLInputElement[]>();

    Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'))
      .filter((node) => isElementVisible(node))
      .forEach((node, index) => {
        const input = node as HTMLInputElement;
        const groupKey = input.name || input.id || `ungrouped-${index + 1}`;
        const existing = groupedInputs.get(groupKey) ?? [];
        existing.push(input);
        groupedInputs.set(groupKey, existing);
      });

    Array.from(groupedInputs.entries()).forEach(([groupKey, inputs], index) => {
      const container = findQuestionContainerForInputs(inputs);
      const id = groupKey || `group-${index + 1}`;

      if (container instanceof HTMLElement) {
        container.dataset.studyAssistantId = id;
      } else {
        inputs.forEach((input) => {
          input.dataset.studyAssistantId = id;
        });
      }

      pushCandidate(
        createQuestionCandidate({
          id,
          prompt: derivePromptFromContainer(container) ?? derivePromptNearInputs(inputs),
          options: inputs.map((input) => extractOptionLabel(input)).filter(Boolean),
          contextLabel:
            (container instanceof HTMLElement ? container.dataset.questionLabel ?? null : null) ??
            deriveQuestionLabel(container),
        }),
      );
    });

    const questionCandidates = candidates.slice(0, MAX_QUESTION_CANDIDATES);

    return {
      candidates: questionCandidates,
      diagnostics: {
        explicitQuestionBlockCount: explicitQuestionBlocks.length,
        structuredQuestionBlockCount: structuredContainers.size,
        groupedInputCount: groupedInputs.size,
        promptCandidateCount: visiblePromptNodes.length,
        questionCandidateCount: questionCandidates.length,
        visibleOptionCount: Array.from(
          new Set(
            questionCandidates.flatMap((candidate) =>
              candidate.options.map((option) => option.toLowerCase()),
            ),
          ),
        ).length,
      },
    };
  }

  function extractOptions(questionCandidates: Array<{ options: string[] }>): string[] {
    if (questionCandidates[0]?.options.length) {
      return questionCandidates[0].options.slice(0, MAX_EXTRACTED_OPTIONS);
    }

    return extractOptionsFromContainer(document, MAX_EXTRACTED_OPTIONS);
  }

  function extractQuestionText(questionCandidates: Array<{ prompt: string }>): string | null {
    if (questionCandidates[0]?.prompt) {
      return questionCandidates[0].prompt.slice(0, 500);
    }

    const candidates = Array.from(
      document.querySelectorAll(
        'main p, main li, article p, article li, form p, form label, [role="main"] p, [data-question], .question, .prompt',
      ),
    )
      .filter((node) => isElementVisible(node))
      .map((node) => normalizeText(node.textContent ?? ''))
      .filter((text) => text.length > 15);

    const questionLike =
      candidates.find((text) => text.includes('?')) ??
      candidates.find((text) => /true or false|choose|select|which of the following/i.test(text)) ??
      null;

    return questionLike ? questionLike.slice(0, 500) : null;
  }

  function extractBreadcrumbs(): string[] {
    return Array.from(document.querySelectorAll('nav[aria-label*="breadcrumb" i] a, nav[aria-label*="breadcrumb" i] li'))
      .filter((node) => isElementVisible(node))
      .map((node) => normalizeText(node.textContent ?? ''))
      .filter(Boolean)
      .slice(0, 12);
  }

  function detectQuizMeta(): { quizTitle: string | null; quizNumber: string | null } {
    const quizPattern = /\b(quiz|exam|assessment|midterm|final|activity|test|practice|reviewer|pretest|posttest)\b[\s:_-]*(\d+)?/i;
    const numberPattern = /\b(?:quiz|exam|assessment|midterm|final|activity|test)\s*#?\s*(\d+)/i;

    const textSources: string[] = [
      document.title,
      ...collectTexts('h1, h2, h3', 10),
      ...extractBreadcrumbs(),
      ...Array.from(document.querySelectorAll('.page-header-headings h1, .page-header-headings h2, .breadcrumb-item, [data-region="page-header"] h1, .activity-header .page-header-headings, .activity-navigation .activity-header'))
        .filter((node) => isElementVisible(node))
        .map((node) => normalizeText(node.textContent ?? ''))
        .filter(Boolean)
        .slice(0, 8),
    ];

    let quizTitle: string | null = null;
    let quizNumber: string | null = null;

    for (const text of textSources) {
      const titleMatch = text.match(quizPattern);
      if (titleMatch && !quizTitle) {
        quizTitle = normalizeText(text).slice(0, 200);
      }

      const numberMatch = text.match(numberPattern);
      if (numberMatch?.[1] && !quizNumber) {
        quizNumber = numberMatch[1];
      }

      if (quizTitle && quizNumber) break;
    }

    return { quizTitle, quizNumber };
  }

  function buildSignals() {
    const headings = collectTexts('h1, h2, h3');
    const visibleLabels = collectTexts('label, button, legend, th');
    const visibleTextExcerpt = collectVisibleText();
    const extractedQuestions = extractQuestionCandidates();
    const questionCandidates = extractedQuestions.candidates;
    const questionText = extractQuestionText(questionCandidates);
    const courseCodeSource = [document.title, ...headings, ...extractBreadcrumbs(), visibleTextExcerpt].join(' ');
    const courseCodes = Array.from(
      new Set(
        (courseCodeSource.match(courseCodePattern) ?? [])
          .map((code) => normalizeText(code))
          .filter(Boolean),
      ),
    ).slice(0, 6);

    const quizMeta = detectQuizMeta();

    return {
      pageUrl: window.location.href,
      pageDomain: window.location.hostname,
      pageTitle: document.title || window.location.hostname,
      headings,
      breadcrumbs: extractBreadcrumbs(),
      visibleLabels,
      visibleTextExcerpt,
      questionText,
      options: extractOptions(questionCandidates),
      questionCandidates,
      diagnostics: {
        ...extractedQuestions.diagnostics,
        courseCodeCount: courseCodes.length,
      },
      courseCodes,
      quizTitle: quizMeta.quizTitle,
      quizNumber: quizMeta.quizNumber,
      totalQuestionsDetected: questionCandidates.length,
      extractedAt: new Date().toISOString(),
    };
  }

  function sendLiveDigest() {
    const snapshot = buildSignals();
    const digest = normalizeText(
      [snapshot.pageTitle, snapshot.questionText ?? '', snapshot.visibleTextExcerpt.slice(0, 220)].join(' | '),
    );

    if (digest === globalState.__studyAssistantLastDigest) {
      return;
    }

    globalState.__studyAssistantLastDigest = digest;
    void chrome.runtime.sendMessage({
      type: 'EXTENSION/LIVE_ASSIST_SIGNAL',
      payload: {
        digest,
        pageTitle: snapshot.pageTitle,
      },
    });
  }

  function startLiveAssist() {
    if (globalState.__studyAssistantLiveObserver) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (globalState.__studyAssistantLiveTimer) {
        window.clearTimeout(globalState.__studyAssistantLiveTimer);
      }

      globalState.__studyAssistantLiveTimer = window.setTimeout(() => {
        sendLiveDigest();
      }, 1200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    globalState.__studyAssistantLiveObserver = observer;
  }

  function stopLiveAssist() {
    globalState.__studyAssistantLiveObserver?.disconnect();
    globalState.__studyAssistantLiveObserver = null;

    if (globalState.__studyAssistantLiveTimer) {
      window.clearTimeout(globalState.__studyAssistantLiveTimer);
      globalState.__studyAssistantLiveTimer = null;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'EXTENSION/EXTRACT_PAGE_SIGNALS') {
      sendResponse({
        ok: true,
        data: buildSignals(),
      });
      return;
    }

    if (message?.type === 'EXTENSION/SET_LIVE_ASSIST') {
      if (message.payload?.enabled) {
        startLiveAssist();
      } else {
        stopLiveAssist();
      }

      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'EXTENSION/AUTO_CLICK_ANSWER') {
      const payload = message.payload as {
        questionId: string;
        answerText: string;
        suggestedOption: string | null;
        options: string[];
      };

      const result = autoClickAnswer(payload);
      sendResponse({ ok: true, data: result });
      return;
    }

    if (message?.type === 'EXTENSION/AUTO_CLICK_NEXT_PAGE') {
      const result = autoClickNextPage();
      sendResponse({ ok: true, data: result });
      return;
    }
  });

  function autoClickNextPage(): { clicked: boolean } {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, input[type="submit"], input[type="button"], a.btn'));
    
    // Moodle specific IDs and classes first
    const moodleNext = candidates.find(el => el.id === 'mod_quiz-next-nav' || el.getAttribute('name') === 'next');
    if (moodleNext && isElementVisible(moodleNext)) {
      moodleNext.click();
      return { clicked: true };
    }

    for (const el of candidates) {
      if (!isElementVisible(el)) continue;

      const text = normalizeText((el as HTMLInputElement).value || el.textContent || '').toLowerCase();
      if (text === 'next' || text === 'next page' || text === 'forward' || text.includes('next page')) {
        el.click();
        return { clicked: true };
      }
    }

    return { clicked: false };
  }

  function normalizeForMatch(s: string): string {
    return s
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
      .toLowerCase();
  }

  function autoClickAnswer(payload: {
    questionId: string;
    answerText: string;
    suggestedOption: string | null;
    options: string[];
  }): { clicked: boolean; clickedText: string | null; matchMethod: string } {
    const targetText = payload.suggestedOption ?? payload.answerText;
    if (!targetText) {
      return { clicked: false, clickedText: null, matchMethod: 'no_answer' };
    }

    const normalizedTarget = normalizeForMatch(targetText);
    const lowerTarget = targetText.trim().toLowerCase();

    // Scope clickables to the specific question container
    const clickables: Array<{ element: HTMLElement; text: string; normalized: string; input: HTMLInputElement | null }> = [];

    const scopedContainer = document.querySelector(`[data-study-assistant-id="${CSS.escape(payload.questionId)}"]`);
    const searchRoot = scopedContainer ?? document;

    // Strategy 1: Radio buttons and checkboxes with labels
    let inputs = Array.from(searchRoot.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'));
    if (!scopedContainer && inputs.length === 0) {
      inputs = Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-study-assistant-id="${CSS.escape(payload.questionId)}"]`));
    }
    if (!scopedContainer && searchRoot === document) {
      const namedInputs = inputs.filter(i => i.name === payload.questionId || i.id === payload.questionId);
      if (namedInputs.length > 0) {
        inputs = namedInputs;
      }
    }

    for (const input of inputs) {
      if (!isElementVisible(input)) continue;

      // Find associated label
      let label: HTMLElement | null = null;
      if (input.id) {
        label = document.querySelector<HTMLElement>(`label[for="${CSS.escape(input.id)}"]`);
      }
      if (!label) {
        label = input.closest('label');
      }
      if (!label) {
        // Check next sibling text or parent
        const parent = input.parentElement;
        if (parent) {
          const text = normalizeText(parent.textContent ?? '');
          if (text.length > 0 && text.length < 500) {
            clickables.push({
              element: parent,
              text,
              normalized: normalizeForMatch(text),
              input,
            });
            continue;
          }
        }
      }

      const labelText = normalizeText(label?.textContent ?? '');
      if (labelText.length > 0) {
        clickables.push({
          element: label ?? input,
          text: labelText,
          normalized: normalizeForMatch(labelText),
          input,
        });
      }
    }

    // Strategy 2: Custom clickable choice containers (div/li/button with choice-like text)
    const choiceContainers = searchRoot.querySelectorAll<HTMLElement>(
      '.answer, .option, .choice, [role="option"], [role="radio"], [data-choice], [data-answer], .que .answer div, .formulation .answer div'
    );
    for (const container of choiceContainers) {
      if (!isElementVisible(container)) continue;
      const text = normalizeText(container.textContent ?? '');
      if (text.length > 0 && text.length < 500) {
        const existing = clickables.find(c => c.normalized === normalizeForMatch(text));
        if (!existing) {
          clickables.push({
            element: container,
            text,
            normalized: normalizeForMatch(text),
            input: container.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'),
          });
        }
      }
    }

    if (clickables.length === 0) {
      return { clicked: false, clickedText: null, matchMethod: 'no_clickables_found' };
    }

    // Match priority: exact → normalized exact → starts with → contains → fuzzy
    let bestMatch: (typeof clickables)[number] | null = null;
    let matchMethod = 'none';

    // 1. Exact normalized match
    for (const c of clickables) {
      if (c.normalized === normalizedTarget) {
        bestMatch = c;
        matchMethod = 'exact';
        break;
      }
    }

    // 2. Lowercase trimmed match
    if (!bestMatch) {
      for (const c of clickables) {
        if (c.text.trim().toLowerCase() === lowerTarget) {
          bestMatch = c;
          matchMethod = 'lowercase';
          break;
        }
      }
    }

    // 3. Target starts with choice text or choice starts with target
    if (!bestMatch) {
      for (const c of clickables) {
        if (normalizedTarget.startsWith(c.normalized) || c.normalized.startsWith(normalizedTarget)) {
          bestMatch = c;
          matchMethod = 'starts_with';
          break;
        }
      }
    }

    // 4. Contains match
    if (!bestMatch) {
      for (const c of clickables) {
        if (c.normalized.includes(normalizedTarget) || normalizedTarget.includes(c.normalized)) {
          bestMatch = c;
          matchMethod = 'contains';
          break;
        }
      }
    }

    // 5. Word-level fuzzy: check if most words in target appear in choice
    if (!bestMatch) {
      const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 2);
      let bestScore = 0;

      for (const c of clickables) {
        const choiceWords = new Set(c.normalized.split(/\s+/));
        const matchCount = targetWords.filter(w => choiceWords.has(w)).length;
        const score = targetWords.length > 0 ? matchCount / targetWords.length : 0;

        if (score > bestScore && score >= 0.6) {
          bestScore = score;
          bestMatch = c;
          matchMethod = 'fuzzy';
        }
      }
    }

    if (!bestMatch) {
      return { clicked: false, clickedText: null, matchMethod: 'no_match' };
    }

    // Perform the click
    try {
      if (bestMatch.input && !bestMatch.input.checked) {
        bestMatch.input.focus();
        bestMatch.input.click();
        bestMatch.input.dispatchEvent(new Event('change', { bubbles: true }));
        bestMatch.input.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (!bestMatch.input) {
        bestMatch.element.click();
      } else {
        // Already checked, still report as clicked
      }
      return { clicked: true, clickedText: bestMatch.text, matchMethod };
    } catch {
      return { clicked: false, clickedText: bestMatch.text, matchMethod: 'click_error' };
    }
  }
}
