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
  // Enhanced pattern for Moodle shortnames like UGRD-IT6206-2522S, UGRD-ITE6220-2522S
  const moodleShortnamePattern = /\b(UGRD|GRAD|GEN|BSCS|BSIT|BSIS|IT|CS|IS|ITE?|NSCI|FILI|ECE|EE|ME|CE|CPE|COE)[\s-]?([A-Z]{0,4}\d{3,5}[A-Z]?)(?:-\d{3,4}[A-Z]?)?\b/i;
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

  function extractCleanedPromptText(node: Element): string {
    const clone = node.cloneNode(true) as HTMLElement;
    
    clone.querySelectorAll('.feedback, .rightanswer, .generalfeedback, .specificfeedback, .history, .info, .state, .grade, .qn_buttons, .controls, .submitbtns, button, nav').forEach(el => el.remove());
    
    clone.querySelectorAll('input[type="text"], input:not([type]), select, .fillintheblank, .correct, .incorrect').forEach(el => {
      el.replaceWith(document.createTextNode(' ___ '));
    });

    // Also strip out screen-reader only elements that inject "Answer"
    clone.querySelectorAll('.accesshide, .sr-only').forEach(el => el.remove());

    // Use extractTextWithSpacing instead of .textContent to preserve
    // word boundaries between block-level elements (p, div, br, li, etc.)
    return normalizeText(extractTextWithSpacing(clone));
  }

  /**
   * Extract text from a DOM node, inserting spaces at block-level element
   * boundaries so that multi-line questions don't merge words.
   *
   * .textContent concatenates everything without spacing, which causes:
   *   "customerii. SRS" instead of "customer ii. SRS"
   *
   * This function walks all child nodes and inserts a space before/after
   * block-level elements (p, div, br, li, tr, h1-h6, etc.)
   */
  function extractTextWithSpacing(node: Node): string {
    const BLOCK_TAGS = new Set([
      'P', 'DIV', 'BR', 'LI', 'TR', 'TD', 'TH', 'DT', 'DD',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'BLOCKQUOTE', 'PRE', 'HR', 'UL', 'OL', 'DL',
      'SECTION', 'ARTICLE', 'HEADER', 'FOOTER',
    ]);

    const parts: string[] = [];

    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        parts.push(child.textContent ?? '');
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName?.toUpperCase() ?? '';

        if (tag === 'BR') {
          parts.push(' ');
          continue;
        }

        const isBlock = BLOCK_TAGS.has(tag);
        if (isBlock) {
          parts.push(' ');
        }

        // Recurse into children
        parts.push(extractTextWithSpacing(el));

        if (isBlock) {
          parts.push(' ');
        }
      }
    }

    return parts.join('');
  }


  function hasVisibleFreeformInputs(container: ParentNode | null): boolean {
    if (!container) {
      return false;
    }

    return Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], input[type="number"], input:not([type]), textarea'))
      .some((node) =>
        isElementVisible(node) &&
        !node.disabled &&
        !node.readOnly &&
        (
          !(node instanceof HTMLInputElement) ||
          !['hidden', 'submit', 'button', 'password', 'email', 'radio', 'checkbox'].includes(node.type)
        ),
      );
  }

  function hasVisibleChoiceInputs(container: ParentNode | null): boolean {
    if (!container) {
      return false;
    }

    // Check for radio/checkbox inputs OR text inputs (fill in the blank) OR <select> dropdown elements
    const hasInput = Array.from(
      container.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"], input[type="number"]')
    ).some((node) => isElementVisible(node));
    if (hasInput) return true;

    // Also check for visible <select> elements (for matching/dropdown questions)
    const hasSelect = Array.from(container.querySelectorAll('select')).some(
      (sel) => isElementVisible(sel) && !sel.disabled && !sel.closest('nav, .quiznav, .question-nav, header, footer')
    );
    return hasSelect;
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

    if (
      /^(question\s*\d+|select one[: ]*|select one or more[: ]*|type an answer|true|false|yes|no|answer[: ]*|response[: ]*|your answer[: ]*|fill in the blank[: ]*|blank[: ]*|blanks[: ]*)$/i.test(normalized) ||
      /^question\s*\d+\s*(select one( or more)?[: ]*)?$/i.test(normalized) ||
      /^(complete|flag question|mark\b|answered|not answered|finish review)$/i.test(normalized)
    ) {
      return true;
    }

    // Aggressive catch-all for any combination of Question X and Select One without actual question content
    const stripped = normalized.replace(/question\s*\d+/gi, '').replace(/select one( or more)?[: ]*/gi, '').replace(/[^a-z0-9]/gi, '');
    if (stripped.length === 0 && (normalized.includes('select') || normalized.match(/^question\s*\d+$/i))) {
      return true;
    }

    // Also catch just the word "select one" or "select one or more" even if buried with whitespace/punctuation
    const strippedNoQNo = normalized.replace(/question\s*\d+/gi, '').trim();
    if (/^select one( or more)?[: .!]*$/i.test(strippedNoQNo)) {
      return true;
    }

    return false;
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

  // Selectors for elements that leak feedback/review text into option labels
  const REVIEW_ARTIFACT_SELECTORS = '.accesshide, .sr-only, [aria-hidden="true"], .feedback, .correctness, .specificfeedback, .generalfeedback, .rightanswer, .state, .grade, .outcome';

  function extractOptionLabel(input: Element): string {
    const id = input.getAttribute('id');

    // ─── Priority 1: Moodle's aria-labelledby → [data-region="answer-label"] ───
    // Moodle multichoice/checkbox questions use aria-labelledby pointing to a
    // sibling div with data-region="answer-label" that wraps the visible option text.
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const ids = ariaLabelledBy.split(/\s+/).filter(Boolean);
      for (const labelId of ids) {
        let labelEl: Element | null = null;
        try {
          labelEl = document.getElementById(labelId);
        } catch {
          // Ignore
        }
        if (labelEl && isElementVisible(labelEl)) {
          const clone = labelEl.cloneNode(true) as HTMLElement;
          clone.querySelectorAll(REVIEW_ARTIFACT_SELECTORS).forEach(el => el.remove());
          // Also remove screen-reader-only answernumber spans that prefix "a. ", "b. "
          clone.querySelectorAll('.answernumber').forEach(el => el.remove());
          const text = normalizeText(clone.textContent ?? '');
          if (text) return text;
        }
      }
    }

    // ─── Priority 2: Standard label[for="id"] association ───
    if (id) {
      let label: Element | null = null;
      try {
        label = document.querySelector(`label[for="${CSS.escape(id)}"]`) ?? document.querySelector(`label[for="${id}"]`);
      } catch {
        // Ignore invalid selectors
      }
      if (label && isElementVisible(label)) {
        const clone = label.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(REVIEW_ARTIFACT_SELECTORS).forEach(el => el.remove());
        return normalizeText(clone.textContent ?? '');
      }
    }

    // ─── Priority 3: Input wrapped inside a <label> ───
    const wrapped = input.closest('label');
    if (wrapped) {
      const clone = wrapped.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(REVIEW_ARTIFACT_SELECTORS).forEach(el => el.remove());
      return normalizeText(clone.textContent ?? '');
    }

    // ─── Priority 4: Moodle data-region="answer-label" sibling ───
    // Some Moodle themes put the label div as a sibling of the input, not referenced by aria-labelledby
    const parent = input.parentElement;
    if (parent) {
      const answerLabel = parent.querySelector('[data-region="answer-label"]') ??
        (parent.nextElementSibling?.matches('[data-region="answer-label"]') ? parent.nextElementSibling : null);
      if (answerLabel && isElementVisible(answerLabel)) {
        const clone = answerLabel.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(REVIEW_ARTIFACT_SELECTORS).forEach(el => el.remove());
        clone.querySelectorAll('.answernumber').forEach(el => el.remove());
        const text = normalizeText(clone.textContent ?? '');
        if (text) return text;
      }
    }

    // ─── Priority 5: Last resort — parent element text ───
    // When multiple radio/checkbox inputs share a parent (e.g. Moodle cramps
    // choices C and D onto the same line), we must only grab text that belongs
    // to THIS specific input, not sibling inputs' text.
    if (parent && isElementVisible(parent)) {
      const siblingInputs = parent.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      if (siblingInputs.length > 1) {
        // Multiple inputs share this parent — extract only text nodes between
        // the current input and the next sibling input.
        const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let foundCurrent = false;
        const textParts: string[] = [];
        let node: Node | null = walker.nextNode();
        while (node) {
          if (node === input) {
            foundCurrent = true;
            node = walker.nextNode();
            continue;
          }
          if (foundCurrent) {
            // Stop at the next radio/checkbox input
            if (node instanceof HTMLElement && (node.matches('input[type="radio"], input[type="checkbox"]') || node.querySelector?.('input[type="radio"], input[type="checkbox"]'))) {
              break;
            }
            if (node.nodeType === Node.TEXT_NODE) {
              textParts.push(node.textContent ?? '');
            }
          }
          node = walker.nextNode();
        }
        const text = normalizeText(textParts.join(''));
        if (text) return text;
      } else {
        // Single input in parent — safe to use full parent text
        const clone = parent.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(REVIEW_ARTIFACT_SELECTORS).forEach(el => el.remove());
        clone.querySelectorAll('input').forEach(el => el.remove());
        const text = normalizeText(clone.textContent ?? '');
        if (text) return text;
      }
    }

    return '';
  }

  function cleanOptionLabel(value: string): string {
    return normalizeText(value)
      .replace(/^\u2022\s*/, '')
      // Strip checkmark/cross symbols that Moodle review pages inject
      .replace(/[\u2713\u2714\u2715\u2716\u2717\u2718✓✗✔✘☑☐⬜⬛●○◉]/g, '')
      // Strip 'Correct'/'Incorrect' feedback text that leaks into labels
      .replace(/\b(?:Your answer is (?:correct|incorrect)\.?|Correct\.?|Incorrect\.?|Partially correct\.?)\b/gi, '')
      .replace(/^[a-z]\.\s+/i, '') // strip choice prefix like "a. ", "b. ", "f. ", etc.
      .replace(/^\d+\.\s+/, '')    // strip numeric prefix like "1. ", "2. "
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractOptionsFromContainer(container: ParentNode | null, limit = MAX_EXTRACTED_OPTIONS): string[] {
    if (!container) {
      return [];
    }

    // Filter out Moodle/LMS boilerplate that leaks into option text
    const isBoilerplateOption = (text: string): boolean => {
      const lower = text.trim().toLowerCase();
      return /^(clear my choice|flag question|check|not yet answered|not answered|answered|finish review|finish attempt|marked out of|mark \d|marks?$|submit|save|cancel|next page|previous page|time left)$/i.test(lower)
        || /^(answer:?|response:?|your answer:?|fill in the blank:?|blank:?|blanks:?)$/i.test(lower)
        || lower.length < 2;
    };

    const fromInputs = Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]'))
      .map((input) => cleanOptionLabel(extractOptionLabel(input)))
      .filter((text) => Boolean(text) && !isBoilerplateOption(text));

    const fromDataOptions = Array.from(container.querySelectorAll('[data-question-option], [role="option"], .option, .choice'))
      .filter((node) => isElementVisible(node))
      .map((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(REVIEW_ARTIFACT_SELECTORS).forEach(el => el.remove());
        return cleanOptionLabel(clone.textContent ?? '');
      })
      .filter((text) => text.length > 2 && text.length < 180 && !isBoilerplateOption(text));

    const fromAnswerRows = Array.from(
      container.querySelectorAll('.answer label, .answer .r0, .answer .r1, .answer .r2, .answer .r3, .answer .flex-fill'),
    )
      .filter((node) => isElementVisible(node))
      .map((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(REVIEW_ARTIFACT_SELECTORS).forEach(el => el.remove());
        return cleanOptionLabel(clone.textContent ?? '');
      })
      .filter((text) => text.length > 2 && text.length < 180 && !isBoilerplateOption(text));

    const fromListItems = Array.from(container.querySelectorAll('li'))
      .filter((node) => isElementVisible(node))
      .map((node) => cleanOptionLabel(node.textContent ?? ''))
      .filter((text) => /^[([]?[a-z0-9ivx]{1,5}[)\].:\s-]/i.test(text) || text.length < 180)
      .filter((text) => text.length > 2 && !isBoilerplateOption(text));

    // Also extract options from <select> dropdown elements
    const fromSelects = Array.from(container.querySelectorAll('select'))
      .filter((sel) => isElementVisible(sel) && !sel.disabled && !sel.closest('nav, .quiznav, .question-nav'))
      .flatMap((sel) =>
        Array.from(sel.querySelectorAll('option'))
          .map((opt) => cleanOptionLabel(opt.textContent ?? ''))
          .filter((text) => text.length > 2 && text.toLowerCase() !== 'choose...' && text.toLowerCase() !== 'choose' && !isBoilerplateOption(text))
      );

    return Array.from(new Set([...fromInputs, ...fromDataOptions, ...fromAnswerRows, ...fromListItems, ...fromSelects])).slice(0, limit);
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
          'label',
          'legend',
          'button',
          'nav',
        ].join(', '),
      )
      .forEach((node) => node.remove());

    clone.querySelectorAll('input[type="text"], input:not([type]), select, .fillintheblank, .correct, .incorrect').forEach((el) => {
      el.replaceWith(document.createTextNode(' ___ '));
    });
    
    clone.querySelectorAll('.accesshide, .sr-only, input[type="radio"], input[type="checkbox"]').forEach(el => el.remove());

    const promptFragments = collectDetachedTextNodeCandidates(clone, optionLookup)
      .map((text) => normalizeText(text))
      .filter(Boolean)
      .filter((text) => !isBoilerplateQuestionText(text, optionLookup));

    const uniqueFragments: string[] = [];
    const seenFragments = new Set<string>();
    promptFragments.forEach((text) => {
      const key = text.toLowerCase();
      if (seenFragments.has(key)) {
        return;
      }

      seenFragments.add(key);
      uniqueFragments.push(text);
    });

    const hasFreeformQuestion = hasVisibleFreeformInputs(container) && extractOptionsFromContainer(container).length === 0;
    if (hasFreeformQuestion) {
      const compositePrompt = normalizeText(uniqueFragments.join(' '));
      return compositePrompt || null;
    }

    const promptCandidate = uniqueFragments
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

    const hasFreeformQuestion = hasVisibleFreeformInputs(container) && extractOptionsFromContainer(container).length === 0;
    const optionLookup = new Set(
      extractOptionsFromContainer(container)
        .map((option) => normalizeText(option).toLowerCase())
        .filter(Boolean),
    );

    const safePromptSelectors = [
      '[data-question-prompt]',
      '.qtext',
      '.questiontext',
      '.question-text',
      '.question-stem',
      '.stem'
    ].join(', ');

    // NOTE: '.prompt' and 'legend' are intentionally NOT in dangerousPromptSelectors anymore.
    // Moodle uses <legend class="prompt"> for "Select one:" / "Select one or more:" boilerplate
    // which was causing the extension to use that phrase as the question text.
    // Any good question text can be found via .qtext or the pruned container approach.
    const dangerousPromptSelectors = [
      '.question-prompt',
    ].join(', ');

    // Try safe selectors first!
    let explicitPrompt = container.querySelector(safePromptSelectors);
    
    // Only try dangerous selectors if no safe prompt was found
    if (!explicitPrompt) {
      const dangerous = container.querySelector(dangerousPromptSelectors);
      // Extra gate: never accept if it reads like moodle boilerplate
      if (dangerous) {
        const dangerousText = extractCleanedPromptText(dangerous);
        if (!isBoilerplateQuestionText(dangerousText, optionLookup)) {
          explicitPrompt = dangerous;
        }
      }
    }

    if (explicitPrompt && isElementVisible(explicitPrompt) && !looksLikeQuestionNavigation(explicitPrompt)) {
      const text = extractCleanedPromptText(explicitPrompt);
      if (text.length >= 12 && !isBoilerplateQuestionText(text, optionLookup)) {
        if (hasFreeformQuestion) {
          const enrichedText = derivePromptFromPrunedContainer(container);
          if (enrichedText && enrichedText.length > text.length) {
            return enrichedText.slice(0, 500);
          }
        }

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

        if (current.querySelector('.qtext, .questiontext, .question-text, .question-prompt')) {
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

  function countVisibleQuestionMarkers(container: ParentNode | null): number {
    if (!container) {
      return 0;
    }

    return Array.from(
      container.querySelectorAll(
        '.info .no, .question-number, .questionnumber, [data-question-block], .que, .quiz-question, [data-region="question"]',
      ),
    ).filter((node) => isElementVisible(node)).length;
  }

  function findQuestionContainerForField(
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ): ParentNode | null {
    let current: HTMLElement | null = field.parentElement;
    let bestContainer: HTMLElement | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const isDropdownField = field instanceof HTMLSelectElement;

    while (current && current !== document.body) {
      if (isElementVisible(current) && current.contains(field)) {
        const normalizedText = normalizeText(current.textContent ?? '');
        const prompt = derivePromptFromContainer(current);
        const questionLabel = deriveQuestionLabel(current);
        const visibleTextInputs = Array.from(
          current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], input[type="number"], input:not([type]), textarea'),
        ).filter(
          (node) =>
            isElementVisible(node) &&
            !node.disabled &&
            !node.readOnly &&
            (!(node instanceof HTMLInputElement) || !['hidden', 'submit', 'button', 'password', 'email'].includes(node.type)),
        ).length;
        const visibleSelects = Array.from(current.querySelectorAll<HTMLSelectElement>('select')).filter(
          (node) => isElementVisible(node) && !node.disabled,
        ).length;

        let score = 0;

        if (prompt) {
          score += 6;
        }

        if (questionLabel) {
          score += 2;
        }

        if (normalizedText.length >= 18 && normalizedText.length <= 1200) {
          score += 2;
        }

        if (normalizedText.length > 1800) {
          score -= 4;
        }

        if (current.matches('.que, .formulation, .content, [data-question-block], .question, .quiz-question, article, section, fieldset')) {
          score += 4;
        }

        if (isDropdownField) {
          if (visibleSelects === 1) {
            score += 7;
          } else if (visibleSelects <= 2) {
            score += 3;
          } else {
            score -= 5;
          }
        } else if (visibleTextInputs === 1) {
          score += 7;
        } else if (visibleTextInputs <= 2) {
          score += 3;
        } else {
          score -= 5;
        }

        const questionMarkerCount = countVisibleQuestionMarkers(current);
        if (questionMarkerCount > 1) {
          score -= 6;
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
      field.closest(
        '.que, .formulation, .content, [data-question-block], .question, .quiz-question, article, section, fieldset, div',
      )
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
          // NOTE: 'fieldset' is intentionally NOT here — Moodle wraps answer choices
          // in <fieldset class="ablock"> which is a sub-container, not the question itself.
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
    questionType?: string | null;
  }) {
    const prompt = normalizeText(input.prompt ?? '');
    const normalizedOptions = input.options.map((option) => normalizeText(option)).filter(Boolean);
    // Allow very short prompts (e.g. 'what', 'who') if there are dropdown options
    const minimumPromptLength = input.questionType === 'dropdown' && normalizedOptions.length >= 2 ? 3 : 12;
    if (prompt.length < minimumPromptLength) {
      return null;
    }

    return {
      id: input.id,
      prompt: prompt.slice(0, 500),
      options: normalizedOptions.slice(0, MAX_EXTRACTED_OPTIONS),
      contextLabel: input.contextLabel ? normalizeText(input.contextLabel).slice(0, 120) : null,
      questionType: input.questionType ?? null,
    };
  }

  /** Detect the question type from the DOM container */
  function detectQuestionType(container: Element): string {
    // Check for checkboxes first (most specific)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length > 0) return 'checkbox';

    // Check for fill-in-the-blank (text inputs, no radio/checkbox/select)
    const textInputs = container.querySelectorAll('input[type="text"], input:not([type])');
    const hasRadioOrCheckbox = container.querySelector('input[type="radio"], input[type="checkbox"]');
    const hasSelect = container.querySelector('select');
    if (textInputs.length > 0 && !hasRadioOrCheckbox && !hasSelect) return 'fill_in_blank';

    // Check for dropdowns
    if (hasSelect) return 'dropdown';

    // Check for picture question (image in the question text area)
    const qtext = container.querySelector('.qtext, .questiontext, .question-text');
    if (qtext && qtext.querySelector('img')) return 'picture';

    // Default: multiple choice (radio buttons or generic)
    return 'multiple_choice';
  }

  function extractQuestionCandidates() {
    const candidates: Array<{
      id: string;
      prompt: string;
      options: string[];
      contextLabel: string | null;
      questionType: string | null;
      parentQuestionId?: string | null;
      dropdownSubIndex?: number | null;
      node: Element;
    }> = [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const structuredContainers = new Set<string>();
    const visiblePromptNodes = Array.from(
      document.querySelectorAll(
        // NOTE: '.prompt' is intentionally NOT here — Moodle uses <legend class="prompt">
        // for boilerplate "Select one:" / "Select one or more:" text which is NOT the question.
        ['[data-question-prompt]', '.qtext', '.questiontext', '.question-text', '.question-prompt', '.question-stem', '.stem'].join(
          ', ',
        ),
      ),
    ).filter((node) => isElementVisible(node) && normalizeText(node.textContent ?? '').length >= 12);

    function pushCandidate(candidate: {
      id: string;
      prompt: string;
      options: string[];
      contextLabel: string | null;
      questionType: string | null;
      parentQuestionId?: string | null;
      dropdownSubIndex?: number | null;
    } | null, node: Element, bypassDedupe: boolean = false) {
      if (!candidate) return;

      const normalizedId = normalizeText(candidate.id);
      
      // Strict exact-ID deduplication (we never want two elements with the exact same ID)
      if (normalizedId && seenIds.has(normalizedId)) {
        return;
      }

      const candidateWithNode = { ...candidate, node };

      if (normalizedId) {
        seenIds.add(normalizedId);
        candidates.push(candidateWithNode);
        return;
      }

      // Semantic deduplication (prevent duplications in unstructured scans)
      // We skip this for Moodle fast-path because Moodle guarantees each .que is a distinct item
      // on the page, even if the text matches exactly.
      if (!bypassDedupe) {
        const key = `${candidate.contextLabel?.toLowerCase() ?? ''}::${candidate.prompt.toLowerCase()}::${candidate.options.join('|').toLowerCase()}`;
        if (seenKeys.has(key)) {
          return;
        }
        seenKeys.add(key);
      }
      
      candidates.push(candidateWithNode);
    }

    // ═══════════════════════════════════════════════════════════════
    // MOODLE FAST PATH: Process all .que containers in DOM order
    // This guarantees correct question ordering on multi-question pages
    // by iterating .que elements sequentially instead of scanning by type.
    // ═══════════════════════════════════════════════════════════════
    const moodleQueContainers = Array.from(
      document.querySelectorAll('.que'),
    ).filter((node) => {
      if (!isElementVisible(node) || looksLikeQuestionNavigation(node)) return false;

      // Skip Moodle "description" type .que blocks — they have no answerable content
      if (node.classList.contains('description')) return false;

      // ── STRICT FILTER: Require a Moodle question number ──────────────
      // Every REAL Moodle question has a question number element like:
      //   <span class="no">Question 1</span>
      //   <span class="questionnumber">1</span>  
      //   <h3 class="no">Question 1</h3>
      // Ghost/description .que blocks do NOT have this.
      // This is the most reliable way to distinguish real questions from
      // informational blocks that also use the .que class.
      const questionNumberEl = node.querySelector(
        '.info .no, .info .questionnumber, .info h3.no, .questionnumber, [class*="qno"]'
      );
      if (!questionNumberEl) return false;

      // Verify the question number text looks like an actual number
      const numText = (questionNumberEl.textContent ?? '').replace(/\D/g, '');
      if (!numText) return false;

      return true;
    });

    if (moodleQueContainers.length >= 2) {
      // This is a Moodle page with multiple questions — use the fast path
      for (let qi = 0; qi < moodleQueContainers.length; qi++) {
        const que = moodleQueContainers[qi] as HTMLElement;
        const queId = que.id || `moodle-que-${qi + 1}`;
        que.dataset.studyAssistantId = queId;
        structuredContainers.add(queId);

        // Extract the question prompt from .qtext or .formulation
        let prompt: string | null = null;
        const qtextEl = que.querySelector('.qtext, .questiontext, .question-text');
        if (qtextEl && isElementVisible(qtextEl)) {
          prompt = extractCleanedPromptText(qtextEl);
        }
        if (!prompt || prompt.length < 3) {
          prompt = derivePromptFromContainer(que);
        }
        if (!prompt || prompt.length < 3) {
          continue; // Skip questions with no extractable text
        }

        // Detect question type and extract options
        const questionType = detectQuestionType(que);
        const options = extractOptionsFromContainer(que);

        // Tag all inputs inside this question
        que.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"], input:not([type]), textarea, select').forEach((input) => {
          (input as HTMLElement).dataset.studyAssistantId = queId;
        });

        // ── Handle dropdowns within questions ──────────────────────────
        // Tag all selects with data attributes for auto-click targeting.
        // IMPORTANT: We do NOT expand multi-dropdown questions into separate
        // candidates. Each .que = exactly 1 candidate. This guarantees the
        // candidate array index matches the Moodle question number (1:1).
        // For multi-dropdown questions, we embed sub-question metadata on the
        // parent candidate so the backend can match each sub-question individually.
        const inlineSelects = Array.from(que.querySelectorAll<HTMLSelectElement>('select'))
          .filter(sel => isElementVisible(sel) && !sel.disabled);

        // Extract sub-question metadata for multi-dropdown questions
        let dropdownSubQuestions: Array<{
          subId: string;
          prompt: string;
          options: string[];
          dropdownId: string;
        }> | null = null;

        if (inlineSelects.length > 1) {
          const subs: Array<{ subId: string; prompt: string; options: string[]; dropdownId: string }> = [];

          for (let si = 0; si < inlineSelects.length; si++) {
            const sel = inlineSelects[si]!;
            const dropdownId = sel.name || sel.id || `${queId}-dropdown-${si + 1}`;
            sel.dataset.studyAssistantId = queId;
            sel.dataset.studyAssistantDropdownId = dropdownId;

            // Extract sub-prompt from the table row or label
            let subPrompt: string | null = null;
            const parentTd = sel.closest('td');
            if (parentTd) {
              const row = parentTd.closest('tr');
              if (row) {
                const cells = Array.from(row.querySelectorAll('td'));
                const textParts: string[] = [];
                for (const cell of cells) {
                  if (cell === parentTd || cell.contains(sel)) continue;
                  const cellText = normalizeText(cell.textContent ?? '');
                  if (cellText.length >= 1) textParts.push(cellText);
                }
                const rowText = textParts.join(' ').trim();
                if (rowText.length >= 1) subPrompt = rowText;
              }
            }

            if (!subPrompt || subPrompt.length < 1) {
              if (sel.id) {
                try {
                  const label = document.querySelector<HTMLElement>(`label[for="${CSS.escape(sel.id)}"]`);
                  if (label) subPrompt = normalizeText(label.textContent ?? '');
                } catch {
                  // ignore
                }
              }
            }

            if (!subPrompt || subPrompt.length < 1) continue;

            const selectOptions = Array.from(sel.querySelectorAll<HTMLOptionElement>('option'))
              .map(opt => normalizeText(opt.textContent ?? ''))
              .filter(text => text.length > 0 && text.toLowerCase() !== 'choose...' && text.toLowerCase() !== 'choose');

            subs.push({
              subId: `${queId}-sub-${si + 1}`,
              prompt: subPrompt,
              options: selectOptions,
              dropdownId,
            });
          }

          if (subs.length > 0) {
            dropdownSubQuestions = subs;
          }
        } else {
          // Single or no selects — just tag them
          for (let si = 0; si < inlineSelects.length; si++) {
            const sel = inlineSelects[si]!;
            const dropdownId = sel.name || sel.id || `${queId}-dropdown-${si + 1}`;
            sel.dataset.studyAssistantId = queId;
            sel.dataset.studyAssistantDropdownId = dropdownId;
          }
        }

        const candidateData = createQuestionCandidate({
          id: queId,
          prompt,
          options,
          contextLabel: que.dataset.questionLabel ?? deriveQuestionLabel(que),
          questionType,
        });

        pushCandidate(
          dropdownSubQuestions
            ? { ...candidateData, dropdownSubQuestions } as any
            : candidateData,
          que
        );
      }

      // Skip all the multi-phase scanning below — we already have all questions
      // in correct DOM order from the .que containers
      const questionCandidates = candidates.slice(0, MAX_QUESTION_CANDIDATES).map(({ node, ...rest }) => ({
        id: rest.id,
        prompt: rest.prompt,
        options: rest.options,
        contextLabel: rest.contextLabel,
        questionType: rest.questionType as any,
        parentQuestionId: rest.parentQuestionId ?? null,
        dropdownSubIndex: rest.dropdownSubIndex ?? null,
        dropdownSubQuestions: (rest as any).dropdownSubQuestions ?? null,
      }));

      return {
        candidates: questionCandidates,
        diagnostics: {
          explicitQuestionBlockCount: 0,
          structuredQuestionBlockCount: moodleQueContainers.length,
          groupedInputCount: 0,
          promptCandidateCount: moodleQueContainers.length,
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

    // ═══════════════════════════════════════════════════════════════
    // GENERIC FALLBACK: Multi-phase scanning for non-Moodle LMS pages
    // (one question per tab, or non-standard DOM structures)
    // ═══════════════════════════════════════════════════════════════

    visiblePromptNodes.forEach((node, index) => {
      const container = resolveStructuredQuestionContainer(node);
      if (!container) {
        return;
      }

      const hasInlineFreeformField =
        hasVisibleFreeformInputs(container) ||
        Array.from(container.querySelectorAll<HTMLSelectElement>('select')).some(
          (select) => isElementVisible(select) && !select.disabled,
        );
      if (hasInlineFreeformField && extractOptionsFromContainer(container).length === 0) {
        return;
      }

      const prompt = derivePromptFromContainer(container) ?? extractCleanedPromptText(node);
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
          questionType: detectQuestionType(container),
        }),
        container
      );
    });

    const explicitQuestionBlocks = Array.from(document.querySelectorAll('[data-question-block]'))
      .filter((node) => isElementVisible(node))
      .filter((node) => !looksLikeQuestionNavigation(node));

    explicitQuestionBlocks.forEach((node, index) => {
        const element = node as HTMLElement;
        const hasInlineFreeformField =
          hasVisibleFreeformInputs(element) ||
          Array.from(element.querySelectorAll<HTMLSelectElement>('select')).some(
            (select) => isElementVisible(select) && !select.disabled,
          );
        if (hasInlineFreeformField && extractOptionsFromContainer(element).length === 0) {
          return;
        }
        const id = element.dataset.questionId || `block-${index + 1}`;
        element.dataset.studyAssistantId = id;
        structuredContainers.add(id);
        pushCandidate(
          createQuestionCandidate({
            id,
            prompt: derivePromptFromContainer(element),
            options: extractOptionsFromContainer(element),
            contextLabel: element.dataset.questionLabel ?? null,
            questionType: detectQuestionType(element),
          }),
          element
        );
      });

    const groupedInputs = new Map<string | HTMLElement, HTMLInputElement[]>();

    Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'))
      .filter((node) => isElementVisible(node))
      .forEach((node, index) => {
        const input = node as HTMLInputElement;
        
        let groupKey: string | HTMLElement = '';
        if (input.type === 'radio' && input.name) {
          groupKey = input.name;
        } else {
          const container = input.closest([
            '.answer', '.answers', '.ablock', '.que', '.formulation', '.question',
            '[data-question-block]', 'fieldset', '[role="group"]', '[role="radiogroup"]',
            '.options', '.choices', '.mcq-options', 'ul', 'ol', 'table', 'tbody',
            '.multichoice', '.checkbox-group'
          ].join(', '));
          
          // Fallback to finding the nearest common parent that looks like a question boundary
          const boundaryContainer = container || input.closest('article, section, .question-container');
          
          if (boundaryContainer instanceof HTMLElement) {
            groupKey = boundaryContainer;
          } else {
            // Unlikely fallback if it's completely loose in the body
            groupKey = input.name || input.id || `ungrouped-${index + 1}`;
          }
        }
        
        const existing = groupedInputs.get(groupKey) ?? [];
        existing.push(input);
        groupedInputs.set(groupKey, existing);
      });

    Array.from(groupedInputs.entries()).forEach(([groupKey, inputs], index) => {
      // Avoid creating a duplicate standalone candidate if these inputs 
      // are already part of a structured question block that we processed
      const parentContainer = inputs[0]?.closest('[data-study-assistant-id]');
      const parentId = parentContainer?.getAttribute('data-study-assistant-id');
      if (parentId && structuredContainers.has(parentId)) {
        // Tag these inputs with the parent ID so they can be securely found during click fallback
        inputs.forEach((input) => {
          input.dataset.studyAssistantId = parentId;
        });
        return;
      }

      const container = findQuestionContainerForInputs(inputs);
      const id = typeof groupKey === 'string' && groupKey ? groupKey : `group-${index + 1}`;

      if (container instanceof HTMLElement) {
        container.dataset.studyAssistantId = id;
      }
      inputs.forEach((input) => {
        input.dataset.studyAssistantId = id;
      });

      pushCandidate(
        createQuestionCandidate({
          id,
          prompt: derivePromptFromContainer(container) ?? derivePromptNearInputs(inputs),
          options: inputs.map((input) => extractOptionLabel(input)).filter(Boolean),
          contextLabel:
            (container instanceof HTMLElement ? container.dataset.questionLabel ?? null : null) ??
            deriveQuestionLabel(container),
          questionType: container instanceof HTMLElement ? detectQuestionType(container) : 'multiple_choice',
        }),
        container instanceof HTMLElement ? container : inputs[0]!
      );
    });

    const blankInputs = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], input:not([type]), textarea'),
    ).filter(
      (node) =>
        isElementVisible(node) &&
        !node.disabled &&
        !node.readOnly &&
        (
          !(node instanceof HTMLInputElement) ||
          !['hidden', 'submit', 'button', 'password', 'email'].includes(node.type)
        ) &&
        !node.closest('nav, .quiznav, .question-nav, .submitbtns, header, footer'),
    );

    blankInputs.forEach((input, index) => {
      const container = findQuestionContainerForField(input) ?? input.parentElement;
      if (!(container instanceof HTMLElement)) {
        return;
      }

      const id =
        input.name ||
        input.id ||
        container.dataset.questionId ||
        container.dataset.studyAssistantId ||
        `blank-${index + 1}`;
      container.dataset.studyAssistantId = id;
      input.dataset.studyAssistantId = id;

      pushCandidate(
        createQuestionCandidate({
          id,
          prompt: derivePromptFromContainer(container),
          options: [],
          contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),
          questionType: 'fill_in_blank',
        }),
        container instanceof HTMLElement ? container : input
      );
    });

    // ═══════════════════════════════════════════════════════════════
    // Strategy: Dropdown <select> sub-question detection
    // Each <select> inside a question container becomes its own sub-question
    // Handles Moodle matching questions with table-based layouts
    // ═══════════════════════════════════════════════════════════════

    // Helper: check if a <select> is a navigation/non-question dropdown
    function isNavigationSelect(sel: HTMLSelectElement): boolean {
      // Filter out quiz navigation, "Jump to..." selects, etc.
      const firstOptText = (sel.querySelector('option')?.textContent ?? '').trim().toLowerCase();
      if (
        firstOptText.includes('jump to') ||
        firstOptText.includes('choose a section') ||
        firstOptText.includes('go to')
      ) {
        return true;
      }
      // Check parent context
      if (sel.closest('.activity-navigation, .mod_quiz_navblock, .jumpmenu, [data-region="nav"]')) {
        return true;
      }
      // If all options look like page titles/sections, it's navigation
      const allOptTexts = Array.from(sel.querySelectorAll('option')).map(o => (o.textContent ?? '').trim().toLowerCase());
      const navPhrases = ['midterm', 'final', 'prelim', 'jump to', 'exam', 'quiz '];
      const navCount = allOptTexts.filter(t => navPhrases.some(p => t.includes(p))).length;
      if (navCount > allOptTexts.length * 0.5 && allOptTexts.length >= 2) {
        return true;
      }
      return false;
    }

    const allSelects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'))
      .filter((sel) =>
        isElementVisible(sel) &&
        !sel.disabled &&
        !sel.name?.includes('sesskey') &&
        !sel.closest('nav, .quiznav, .question-nav, header, footer, .submitbtns, .activity-navigation') &&
        !isNavigationSelect(sel)
      );

    if (allSelects.length > 0) {
      // Group selects by parent question container
      const selectContainerMap = new Map<HTMLElement, HTMLSelectElement[]>();

      for (const sel of allSelects) {
        const container = (findQuestionContainerForField(sel) as HTMLElement | null) ?? sel.parentElement;
        if (!container) continue;

        const existing = selectContainerMap.get(container) ?? [];
        existing.push(sel);
        selectContainerMap.set(container, existing);
      }

      // Extract the parent question text from the container for context enrichment
      function getContainerQuestionContext(container: HTMLElement): string {
        const qtextEl = container.querySelector('.qtext, .questiontext, .question-text, .prompt, .question-prompt, .question-stem, .stem');
        if (qtextEl && isElementVisible(qtextEl)) {
          const text = normalizeText(qtextEl.textContent ?? '');
          if (text.length >= 8) return text;
        }
        // Try deriving from pruned container
        const derived = derivePromptFromContainer(container);
        if (derived && derived.length >= 8) return derived;
        return '';
      }

      let dropdownContainerIndex = 0;
      for (const [container, selects] of selectContainerMap) {
        dropdownContainerIndex++;

        // Get parent question context once for all sub-dropdowns
        const parentContext = getContainerQuestionContext(container);

        // For each <select>, create a sub-question with the text label near it
        for (let si = 0; si < selects.length; si++) {
          const sel = selects[si]!;
          const subId = sel.name || sel.id || `dropdown-${dropdownContainerIndex}-${si + 1}`;

          // ── Extract the prompt text for this specific dropdown ──
          let subPrompt: string | null = null;

          // 1. Check for explicit <label for="...">
          if (sel.id) {
            const label = document.querySelector<HTMLElement>(`label[for="${escapeSelectorValue(sel.id)}"]`);
            if (label && !label.classList.contains('accesshide') && !label.classList.contains('sr-only')) {
              const labelText = normalizeText(label.textContent ?? '');
              const lowerLabel = labelText.toLowerCase();
              // Ignore Moodle's boilerplate screen-reader labels
              if (
                !lowerLabel.startsWith('answer') &&
                !lowerLabel.includes('choose') &&
                !lowerLabel.includes('jump') &&
                labelText.length >= 1
              ) {
                subPrompt = labelText;
              }
            }
          }

          // 2. Moodle table row: extract from sibling <td> cell (not the cell with the select)
          if (!subPrompt || subPrompt.length < 1) {
            const parentTd = sel.closest('td');
            if (parentTd) {
              const row = parentTd.closest('tr');
              if (row) {
                // Get text from all <td> cells EXCEPT the one containing the select
                const cells = Array.from(row.querySelectorAll('td'));
                const textParts: string[] = [];
                for (const cell of cells) {
                  if (cell === parentTd || cell.contains(sel)) continue;
                  const cellText = normalizeText(cell.textContent ?? '');
                  if (cellText.length >= 1) {
                    textParts.push(cellText);
                  }
                }
                const rowText = textParts.join(' ').trim();
                if (rowText.length >= 1 && rowText.length < 500) {
                  subPrompt = rowText;
                }
              }
            }
          }

          // 3. Try closest row container (including Moodle answer row classes)
          if (!subPrompt || subPrompt.length < 1) {
            const row = sel.closest('tr, .fitem, .form-group, .r0, .r1, .r2, .r3');
            if (row instanceof HTMLElement) {
              const clone = row.cloneNode(true) as HTMLElement;
              clone.querySelectorAll('select, button, .submitbtns, .accesshide, .sr-only').forEach(n => n.remove());
              const rowText = normalizeText(clone.textContent ?? '');
              if (rowText.length >= 1 && rowText.length < 500) {
                subPrompt = rowText;
              }
            }
          }

          // 4. Try previous sibling element text
          if (!subPrompt || subPrompt.length < 1) {
            let prevEl: Element | null = sel.previousElementSibling;
            if (!prevEl) {
              prevEl = sel.parentElement?.previousElementSibling ?? null;
            }
            if (prevEl && isElementVisible(prevEl)) {
              const text = normalizeText(prevEl.textContent ?? '');
              if (text.length >= 1 && text.length < 500) {
                subPrompt = text;
              }
            }
          }

          // 5. Fallback: extract text from parent element, excluding the select
          if (!subPrompt || subPrompt.length < 1) {
            const parent = sel.parentElement;
            if (parent) {
              const clone = parent.cloneNode(true) as HTMLElement;
              clone.querySelectorAll('select, button, .accesshide, .sr-only').forEach(n => n.remove());
              const parentText = normalizeText(clone.textContent ?? '');
              if (parentText.length >= 1) {
                subPrompt = parentText;
              }
            }
          }

          if (!subPrompt || subPrompt.length < 1) continue;

          // Extract options from this specific <select>
          const selectOptions = Array.from(sel.querySelectorAll<HTMLOptionElement>('option'))
            .map(opt => normalizeText(opt.textContent ?? ''))
            .filter(text => text.length > 0 && text.toLowerCase() !== 'choose...' && text.toLowerCase() !== 'choose' && text.trim() !== '');

          // Mark this select with a study-assistant ID for auto-click scoping
          sel.dataset.studyAssistantDropdownId = subId;
          sel.dataset.studyAssistantId = subId;

          // Mark the question container too
          if (!container.dataset.studyAssistantId) {
            container.dataset.studyAssistantId = `dropdown-container-${dropdownContainerIndex}`;
          }

          // For short sub-prompts, include the parent context in contextLabel for
          // richer subject detection, but keep prompt raw for exact Q&A matching.
          const subContextLabel =
            subPrompt.length < 12 && parentContext
              ? `${deriveQuestionLabel(container) ?? ''} ${parentContext}`.trim().slice(0, 120) || null
              : deriveQuestionLabel(container);

          pushCandidate(
            createQuestionCandidate({
              id: subId,
              prompt: subPrompt,
              options: selectOptions,
              contextLabel: subContextLabel,
              questionType: 'dropdown',
            }),
            sel
          );
        }
      }
    }

    candidates.sort((a, b) => {
      const position = a.node.compareDocumentPosition(b.node);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    const questionCandidates = candidates.slice(0, MAX_QUESTION_CANDIDATES).map(({ node, ...rest }) => ({
      id: rest.id,
      prompt: rest.prompt,
      options: rest.options,
      contextLabel: rest.contextLabel,
      questionType: rest.questionType as any,
    }));

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

  /**
   * Extract the current course name from Moodle LMS page structure.
   * Priority: breadcrumb course shortname > sidebar active course > page heading
   *
   * Moodle breadcrumbs typically show:
   *   Home > My courses > UGRD-IT6206-2522S > Final Examination > Final Exam
   * The course shortname (e.g., UGRD-IT6206-2522S) is the most reliable signal.
   */
  function extractMoodleCourseName(): { courseName: string | null; courseCode: string | null; courseShortname: string | null } {
    let courseName: string | null = null;
    let courseCode: string | null = null;
    let courseShortname: string | null = null;

    // Strategy 1: Breadcrumb — course link is usually the 3rd breadcrumb item
    // Pattern: Home > My courses > [COURSE_SHORTNAME] > [ACTIVITY_SECTION] > [QUIZ_NAME]
    const breadcrumbLinks = Array.from(
      document.querySelectorAll(
        'nav[aria-label*="breadcrumb" i] a, .breadcrumb a, .breadcrumb-item a, ol.breadcrumb li a'
      ),
    ).filter(el => isElementVisible(el));

    for (const link of breadcrumbLinks) {
      const href = (link as HTMLAnchorElement).href ?? '';
      const text = normalizeText(link.textContent ?? '');
      // Course view links contain /course/view.php?id= — the text is the course shortname
      if (href.includes('/course/view.php') || href.includes('/course/')) {
        courseShortname = text;
        // Extract course code from shortname like "UGRD-IT6206-2522S" → "IT6206"
        const codeMatch = text.match(moodleShortnamePattern);
        if (codeMatch && codeMatch[1] && codeMatch[2]) {
          courseCode = (codeMatch[1] + codeMatch[2]).replace(/[\s-]/g, '').toUpperCase();
        }
        break;
      }
    }

    // Strategy 2: Sidebar nav drawer — look for the currently active course link
    if (!courseShortname) {
      const sidebarCourseLinks = Array.from(
        document.querySelectorAll(
          '#nav-drawer a[href*="/course/view.php"], .nav-drawer a[href*="/course/view.php"], ' +
          '[data-key="mycourses"] a[href*="/course/view.php"], ' +
          '.list-group a[href*="/course/view.php"], ' +
          'nav a[href*="/course/view.php"]'
        ),
      );

      // The active course might share a URL path segment with the current page
      const currentPath = window.location.pathname;
      for (const link of sidebarCourseLinks) {
        const el = link as HTMLAnchorElement;
        const linkUrl = new URL(el.href, window.location.origin);
        // Check if this course is "active" (has aria-current or active class)
        const isActive = el.getAttribute('aria-current') === 'true'
          || el.classList.contains('active')
          || el.closest('.active') !== null;

        if (isActive || currentPath.startsWith(linkUrl.pathname.replace('/course/view.php', ''))) {
          const text = normalizeText(el.textContent ?? '');
          if (text && text.length > 2) {
            courseShortname = text;
            const codeMatch = text.match(moodleShortnamePattern);
            if (codeMatch && codeMatch[1] && codeMatch[2]) {
              courseCode = (codeMatch[1] + codeMatch[2]).replace(/[\s-]/g, '').toUpperCase();
            }
            break;
          }
        }
      }
    }

    // Strategy 3: Page heading — Moodle sometimes shows course name in .page-header-headings
    if (!courseShortname) {
      const courseHeading = document.querySelector('.page-context-header h1, .page-header-headings h1');
      if (courseHeading && isElementVisible(courseHeading)) {
        const text = normalizeText(courseHeading.textContent ?? '');
        const codeMatch = text.match(moodleShortnamePattern);
        if (codeMatch && codeMatch[1] && codeMatch[2]) {
          courseShortname = text;
          courseCode = (codeMatch[1] + codeMatch[2]).replace(/[\s-]/g, '').toUpperCase();
        }
      }
    }

    // Strategy 4: Extract from the current URL path
    // Some Moodle URLs contain the course id or shortname directly
    if (!courseCode) {
      const urlMatch = window.location.href.match(moodleShortnamePattern);
      if (urlMatch && urlMatch[1] && urlMatch[2]) {
        courseCode = (urlMatch[1] + urlMatch[2]).replace(/[\s-]/g, '').toUpperCase();
      }
    }

    // Strategy 5: Document title sometimes has the course shortname
    // e.g., "Final Exam (page 1 of 50)" doesn't help, but "UGRD-IT6206: Final Exam" would
    if (!courseCode) {
      const titleMatch = document.title.match(moodleShortnamePattern);
      if (titleMatch && titleMatch[1] && titleMatch[2]) {
        courseCode = (titleMatch[1] + titleMatch[2]).replace(/[\s-]/g, '').toUpperCase();
      }
    }

    // Try to extract a readable course name from the shortname
    // e.g., "UGRD-IT6206-2522S" → look for nearby full name text
    if (courseShortname && !courseName) {
      // Check if there's an expanded name in the sidebar or breadcrumb title attribute
      const courseLink = document.querySelector(`a[title][href*="/course/view.php"]`) as HTMLAnchorElement;
      if (courseLink) {
        const titleAttr = courseLink.getAttribute('title');
        if (titleAttr && titleAttr.length > courseShortname.length) {
          courseName = normalizeText(titleAttr);
        }
      }
    }

    return { courseName, courseCode, courseShortname };
  }

  function extractBreadcrumbs(): string[] {
    return Array.from(
      document.querySelectorAll(
        [
          'nav[aria-label*="breadcrumb" i] a',
          'nav[aria-label*="breadcrumb" i] li',
          '.breadcrumb a',
          '.breadcrumb li',
          '.breadcrumb-item',
          '.breadcrumb-item a',
          '.breadcrumb-nav a',
          '.breadcrumb-nav li',
          '.page-context-header .breadcrumb a',
          '.page-context-header .breadcrumb li',
          '[data-region="page-header"] .breadcrumb a',
          '[data-region="page-header"] .breadcrumb li',
        ].join(', '),
      ),
    )
      .filter((node) => isElementVisible(node))
      .map((node) => normalizeText(node.textContent ?? ''))
      .filter(Boolean)
      .slice(0, 12);
  }

  function extractCourseHeadingCandidates(): string[] {
    return Array.from(
      document.querySelectorAll(
        [
          '.page-header-headings h1',
          '.page-header-headings h2',
          '.page-context-header h1',
          '.page-context-header h2',
          '[data-region="page-header"] h1',
          '[data-region="page-header"] h2',
          '.activity-header h1',
          '.activity-header h2',
          'h1',
          'h2',
        ].join(', '),
      ),
    )
      .filter((node) => isElementVisible(node))
      .map((node) => normalizeText(node.textContent ?? ''))
      .filter(Boolean)
      .slice(0, 16);
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
    const headings = Array.from(
      new Set([
        ...extractCourseHeadingCandidates(),
        ...collectTexts('h1, h2, h3'),
      ]),
    ).slice(0, 20);
    const breadcrumbs = extractBreadcrumbs();
    const visibleLabels = collectTexts('label, button, legend, th');
    const visibleTextExcerpt = collectVisibleText();
    const extractedQuestions = extractQuestionCandidates();
    const questionCandidates = extractedQuestions.candidates;
    const questionText = extractQuestionText(questionCandidates);
    const primaryHeading = headings[0] ?? '';
    const pageTitle = Array.from(new Set([document.title, primaryHeading].map((value) => normalizeText(value)).filter(Boolean))).join(' | ')
      || window.location.hostname;

    // ─── Moodle-specific course detection ─────────────────────────
    const moodleCourse = extractMoodleCourseName();

    // Inject the Moodle course shortname and name into headings for better scoring
    const enhancedHeadings = [...headings];
    if (moodleCourse.courseShortname && !enhancedHeadings.includes(moodleCourse.courseShortname)) {
      enhancedHeadings.unshift(moodleCourse.courseShortname);
    }
    if (moodleCourse.courseName && !enhancedHeadings.includes(moodleCourse.courseName)) {
      enhancedHeadings.unshift(moodleCourse.courseName);
    }

    const courseCodeSource = [pageTitle, ...enhancedHeadings, ...breadcrumbs, visibleTextExcerpt].join(' ');
    const rawCourseCodes = Array.from(
      new Set(
        (courseCodeSource.match(courseCodePattern) ?? [])
          .map((code) => normalizeText(code))
          .filter(Boolean),
      ),
    );

    // Also extract Moodle-format codes and add the cleaned course code
    const moodleCodes = Array.from(
      new Set(
        (courseCodeSource.match(moodleShortnamePattern) ?? [])
          .map((match) => {
            // Strip Moodle-specific prefix/suffix: UGRD-IT6206-2522S → IT6206
            return match
              .replace(/^(UGRD|GRAD|GEN)-?/i, '')
              .replace(/-\d{3,4}[A-Z]?$/i, '')
              .replace(/[\s-]+/g, '')
              .toUpperCase();
          })
          .filter(Boolean),
      ),
    );

    // Add the detected Moodle course code if present
    if (moodleCourse.courseCode) {
      moodleCodes.push(moodleCourse.courseCode);
    }

    const courseCodes = Array.from(
      new Set([...rawCourseCodes, ...moodleCodes]),
    ).slice(0, 10);

    const quizMeta = detectQuizMeta();

    return {
      pageUrl: window.location.href,
      pageDomain: window.location.hostname,
      pageTitle,
      headings: enhancedHeadings.slice(0, 20),
      breadcrumbs,
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
      totalQuestionsDetected: extractedQuestions.diagnostics.structuredQuestionBlockCount || questionCandidates.length,
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
        questionType?: string | null;
      };

      const result = autoClickAnswer(payload);
      sendResponse({ ok: true, data: result });
      return;
    }

    if (message?.type === 'EXTENSION/AUTO_CLICK_DROPDOWN_ANSWERS') {
      const payload = message.payload as {
        questionId: string;
        dropdownAnswers: Array<{
          dropdownId: string;
          suggestedOption: string | null;
          answerText: string | null;
          confidence: number | null;
        }>;
      };

      let filledCount = 0;
      const filledTexts: string[] = [];

      for (const answer of payload.dropdownAnswers) {
        const answerText = answer.suggestedOption ?? answer.answerText;
        if (!answerText) continue;

        // Find the specific select by dropdown ID
        let select: HTMLSelectElement | null = document.querySelector<HTMLSelectElement>(
          `select[data-study-assistant-dropdown-id="${escapeSelectorValue(answer.dropdownId)}"]`
        );

        // Fallback: find by name or id
        if (!select) {
          select = document.querySelector<HTMLSelectElement>(
            `select[name="${escapeSelectorValue(answer.dropdownId)}"], select[id="${escapeSelectorValue(answer.dropdownId)}"]`
          );
        }

        if (!select || !isElementVisible(select) || select.disabled) continue;

        // Match the answer against select options
        const normalizedAnswer = normalizeForMatch(answerText);
        const options = Array.from(select.querySelectorAll<HTMLOptionElement>('option'));
        let bestOption: HTMLOptionElement | null = null;
        let bestScore = 0;

        for (const opt of options) {
          const optText = normalizeText(opt.textContent ?? '');
          if (!optText || opt.value === '' || optText.toLowerCase() === 'choose...' || optText.toLowerCase() === 'choose') continue;
          const normalizedOpt = normalizeForMatch(optText);

          // Exact match
          if (normalizedOpt === normalizedAnswer) {
            bestOption = opt;
            bestScore = 1;
            break;
          }

          // Contains match with strong ratio
          if (normalizedOpt.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedOpt)) {
            const shorter = Math.min(normalizedOpt.length, normalizedAnswer.length);
            const longer = Math.max(normalizedOpt.length, normalizedAnswer.length);
            const ratio = longer > 0 ? shorter / longer : 0;
            if (ratio >= 0.7 && ratio > bestScore) {
              bestOption = opt;
              bestScore = ratio;
            }
          }

          // Word fuzzy match
          const targetWords = normalizedAnswer.split(/\s+/).filter(w => w.length > 2);
          if (targetWords.length > 0) {
            const optWords = new Set(normalizedOpt.split(/\s+/));
            const matchCount = targetWords.filter(w => optWords.has(w)).length;
            const score = matchCount / targetWords.length;
            if (score > bestScore && score >= 0.7) {
              bestOption = opt;
              bestScore = score;
            }
          }
        }

        if (bestOption) {
          select.value = bestOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
          filledCount++;
          filledTexts.push(normalizeText(bestOption.textContent ?? ''));
        }
      }

      sendResponse({
        ok: true,
        data: {
          clicked: filledCount > 0,
          clickedText: filledTexts.join(', '),
          matchMethod: 'dropdown_multi_fill',
          filledCount,
          totalDropdowns: payload.dropdownAnswers.length,
        },
      });
      return;
    }

    if (message?.type === 'EXTENSION/AUTO_CLICK_NEXT_PAGE') {
      const result = autoClickNextPage();
      sendResponse({ ok: true, data: result });
      return;
    }
  });

  function autoClickNextPage(): { clicked: boolean; isLastPage?: boolean } {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, input[type="submit"], input[type="button"], a.btn, a[href*="summary"]'));
    
    // Moodle specific IDs and classes first (Next button)
    const moodleNext = candidates.find(el => el.id === 'mod_quiz-next-nav' || el.getAttribute('name') === 'next');
    if (moodleNext && isElementVisible(moodleNext)) {
      moodleNext.click();
      return { clicked: true, isLastPage: false };
    }

    // Try finding "next page" by text priority
    for (const el of candidates) {
      if (!isElementVisible(el)) continue;

      const text = normalizeText((el as HTMLInputElement).value || el.textContent || '').toLowerCase();
      if (text === 'next' || text === 'next page' || text === 'forward' || text.includes('next page')) {
        el.click();
        return { clicked: true, isLastPage: false };
      }
    }

    // If no Next button found, look for "finish attempt" to mark the end of the quiz
    for (const el of candidates) {
      if (!isElementVisible(el)) continue;

      const text = normalizeText((el as HTMLInputElement).value || el.textContent || '').toLowerCase();
      if (text === 'finish attempt' || text === 'finish attempt ...' || text.includes('finish attempt')) {
        setTimeout(() => el.click(), 50);
        return { clicked: true, isLastPage: true }; // Flag that this is the last page
      }
    }

    return { clicked: false };
  }

  function normalizeForMatch(s: string): string {
    return s
      .toLowerCase()
      .replace(/^[a-e]\.\s+/i, '') // strip choice prefix like "a. ", "b. "
      .replace(/^\d+\.\s+/, '')    // strip numeric prefix like "1. ", "2. "
      // Preserve ALL programming-relevant special characters:
      // () [] {} $ ; : ! ? < > / \ | ~ ^ & ' " → - # * @ + = % , .
      // Only strip control characters, zero-width spaces, and truly invisible chars
      .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202f\ufeff]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isIgnoredClickableText(value: string): boolean {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) {
      return true;
    }

    return /^(?:clear my choice|flag question|check|not yet answered|not answered|answered|finish review|finish attempt|marked out of|mark \d+|marks?|submit|save|cancel|next page|previous page|time left|jump to|quiz navigation|response:?|your answer:?|answer:?|choose\.{0,3}|choose an option|select one:?|select one or more:?)$/i.test(
      normalized,
    );
  }

  function splitAnswerSegments(value: string): string[] {
    const normalized = normalizeText(value);
    if (!normalized) {
      return [];
    }

    const segments = normalized
      .split(/\s*(?:\||,|;|\/|\band\b|&|\+)\s*/i)
      .map((segment) => normalizeText(segment))
      .filter((segment) => segment.length >= 2);

    if (segments.length < 2 || segments.length > 8) {
      return [];
    }

    return Array.from(new Set(segments));
  }

  function escapeSelectorValue(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }

    return value.replace(/["\\]/g, '\\$&');
  }

  function autoClickAnswer(payload: {
    questionId: string;
    answerText: string;
    suggestedOption: string | null;
    options: string[];
    questionType?: string | null;
  }): { clicked: boolean; clickedText: string | null; matchMethod: string } {
    function setControlValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
      input.focus();
      input.dispatchEvent(new Event('focus', { bubbles: true }));

      const nativeSetter = Object.getOwnPropertyDescriptor(
        input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(input, value);
      } else {
        input.value = value;
      }

      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    const targetText = payload.suggestedOption ?? payload.answerText;
    if (!targetText) {
      return { clicked: false, clickedText: null, matchMethod: 'no_answer' };
    }

    // Scope to the specific question container if available
    const scopedContainer = document.querySelector(`[data-study-assistant-id="${escapeSelectorValue(payload.questionId)}"]`);
    const searchRoot = scopedContainer ?? document;
    
    // ═══════════════════════════════════════════════════════════════
    // Type-aware routing: use backend questionType to skip irrelevant strategies
    // ═══════════════════════════════════════════════════════════════
    const knownType = payload.questionType ?? null;

    // ═══════════════════════════════════════════════════════════════
    // Strategy A: Fill-in-the-blank — text inputs and textareas
    // ═══════════════════════════════════════════════════════════════
    const directTaggedTextInputs = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        `input[type="text"][data-study-assistant-id="${escapeSelectorValue(payload.questionId)}"], input:not([type])[data-study-assistant-id="${escapeSelectorValue(payload.questionId)}"], textarea[data-study-assistant-id="${escapeSelectorValue(payload.questionId)}"]`,
      ),
    );

    const textInputs = (directTaggedTextInputs.length > 0
      ? directTaggedTextInputs
      : Array.from(
          searchRoot.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
            'input[type="text"], input:not([type]), textarea',
          ),
        )
    ).filter(
      (el) =>
        isElementVisible(el) &&
        !el.readOnly &&
        !el.disabled &&
        el.type !== 'hidden' &&
        el.type !== 'submit' &&
        el.type !== 'button' &&
        el.type !== 'password' &&
        el.type !== 'email' &&
        !el.name?.includes('sesskey') &&
        !el.name?.includes('_csrf') &&
        !el.closest('nav, .quiznav, .question-nav, .submitbtns, header, footer'),
    );

    // Skip fill-in-blank strategy if we know this is a radio/checkbox/dropdown question
    if (knownType && knownType !== 'fill_in_blank' && knownType !== 'picture') {
      // Skip to the appropriate strategy
    } else if (false) {
      // placeholder
    } else
    // For fill-in-the-blank: if there's exactly 1 text input in the question,
    // fill it with the raw answer text (not the suggestedOption which is for choices).
    // If multiple inputs, try to match by proximity or just fill the first empty one.
    if (textInputs.length > 0) {
      const answerForFill = payload.answerText || targetText;
      // Check if these are actual blank-answer inputs, not search boxes etc.
      const blankInputs = textInputs.filter((el) => {
        // Must be inside a question-like container (Moodle: .que, .formulation, etc.)
        const inQuestion =
          !!scopedContainer ||
          !!el.closest('.que, .formulation, .question, .qtext, [class*="question"], .content, .answer');
        return inQuestion;
      });

      if (blankInputs.length > 0) {
        const normalizedFillAnswer = normalizeForMatch(answerForFill);
        let filled = false;
        for (const input of blankInputs) {
          const normalizedCurrentValue = normalizeForMatch(input.value.trim());
          const normalizedPlaceholder = normalizeForMatch(input.placeholder?.trim() ?? '');
          const shouldFill =
            normalizedCurrentValue.length === 0 ||
            normalizedCurrentValue === normalizedPlaceholder ||
            normalizedCurrentValue !== normalizedFillAnswer;

          if (!shouldFill) {
            continue;
          }

          setControlValue(input, answerForFill);
          filled = normalizeForMatch(input.value.trim()) === normalizedFillAnswer;
          if (!filled && input.value.trim() === '') {
            setControlValue(input, answerForFill);
            filled = normalizeForMatch(input.value.trim()) === normalizedFillAnswer;
          }

          if (filled) {
            break; // Fill one input per question
          }
        }
        if (filled) {
          return { clicked: true, clickedText: answerForFill, matchMethod: 'fill_in_blank' };
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Strategy B: Dropdown <select> elements
    // First try to find a specific <select> matching this sub-question ID
    // ═══════════════════════════════════════════════════════════════
    
    // Try to find a specific dropdown tagged for this sub-question
    let targetSelects: HTMLSelectElement[] = [];
    const specificDropdown = document.querySelector<HTMLSelectElement>(
      `select[data-study-assistant-dropdown-id="${escapeSelectorValue(payload.questionId)}"]`
    );
    if (specificDropdown && isElementVisible(specificDropdown) && !specificDropdown.disabled) {
      targetSelects = [specificDropdown];
    }

    // Also try matching by select name/id
    if (targetSelects.length === 0) {
      const directTaggedSelect = document.querySelector<HTMLSelectElement>(
        `select[data-study-assistant-id="${escapeSelectorValue(payload.questionId)}"]`,
      );
      if (directTaggedSelect && isElementVisible(directTaggedSelect) && !directTaggedSelect.disabled) {
        targetSelects = [directTaggedSelect];
      }
    }

    if (targetSelects.length === 0) {
      const byName = searchRoot.querySelector<HTMLSelectElement>(`select[name="${escapeSelectorValue(payload.questionId)}"]`);
      if (byName && isElementVisible(byName) && !byName.disabled) {
        targetSelects = [byName];
      }
    }

    // Fallback: all selects in the search root (for non-sub-question cases)
    if (targetSelects.length === 0) {
      targetSelects = Array.from(
        searchRoot.querySelectorAll<HTMLSelectElement>('select')
      ).filter(
        (el) =>
          isElementVisible(el) &&
          !el.disabled &&
          !el.name?.includes('sesskey') &&
          !el.closest('nav, .quiznav, .question-nav, header, footer')
      );
    }

    if (targetSelects.length > 0) {
      // For dropdown questions, use targetText which prioritizes the explicitly matched
      // suggestedOption from the backend algorithms over the raw answerText.
      const answerForDropdown = targetText;
      const normalizedDropdownAnswer = normalizeForMatch(answerForDropdown);
      let dropdownFilled = false;

      for (const select of targetSelects) {
        // Skip already answered selects (non-default value selected)
        const currentValue = select.value;
        const defaultOption = select.querySelector<HTMLOptionElement>('option[value=""], option:first-child');
        const isDefault = !currentValue || currentValue === '' || currentValue === (defaultOption?.value ?? '');
        
        if (!isDefault) continue; // Already answered

        const options = Array.from(select.querySelectorAll<HTMLOptionElement>('option'));
        let bestOption: HTMLOptionElement | null = null;
        let bestScore = 0;
        let bestMethod = 'none';

        for (const opt of options) {
          const optText = normalizeText(opt.textContent ?? '');
          if (!optText || opt.value === '' || optText.toLowerCase() === 'choose...' || optText.toLowerCase() === 'choose') {
            continue;
          }
          const normalizedOpt = normalizeForMatch(optText);

          // Exact match
          if (normalizedOpt === normalizedDropdownAnswer) {
            bestOption = opt;
            bestScore = 1;
            bestMethod = 'dropdown_exact';
            break;
          }

          // Contains match — only accept if the ratio is strong (≥ 80%)
          if (normalizedOpt.includes(normalizedDropdownAnswer) || normalizedDropdownAnswer.includes(normalizedOpt)) {
            const shorter = Math.min(normalizedOpt.length, normalizedDropdownAnswer.length);
            const longer = Math.max(normalizedOpt.length, normalizedDropdownAnswer.length);
            const ratio = longer > 0 ? shorter / longer : 0;
            if (ratio >= 0.8 && 0.9 > bestScore) {
              bestOption = opt;
              bestScore = 0.9;
              bestMethod = 'dropdown_contains';
            }
          }

          // Word fuzzy match — strict threshold
          const targetWords = normalizedDropdownAnswer.split(/\s+/).filter(w => w.length > 2);
          if (targetWords.length > 0) {
            const optWords = new Set(normalizedOpt.split(/\s+/));
            const matchCount = targetWords.filter(w => optWords.has(w)).length;
            const score = matchCount / targetWords.length;
            if (score > bestScore && score >= 0.8) {
              bestOption = opt;
              bestScore = score;
              bestMethod = 'dropdown_fuzzy';
            }
          }
        }

        if (bestOption) {
          select.value = bestOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
          dropdownFilled = true;
          // Don't break — there may be multiple dropdowns in one question (e.g. matching)
        }
      }

      if (dropdownFilled) {
        return { clicked: true, clickedText: answerForDropdown, matchMethod: 'dropdown_select' };
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Strategy C: Radio buttons and checkboxes (existing logic)
    // ═══════════════════════════════════════════════════════════════
    const clickables: Array<{ element: HTMLElement; text: string; normalized: string; input: HTMLInputElement | null }> = [];

    // Strategy 1: Radio buttons and checkboxes with labels
    let inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][data-study-assistant-id="${escapeSelectorValue(payload.questionId)}"], input[type="checkbox"][data-study-assistant-id="${escapeSelectorValue(payload.questionId)}"]`,
      ),
    );
    if (inputs.length === 0) {
      inputs = Array.from(searchRoot.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'));
    }
    if (!scopedContainer && searchRoot === document) {
      const namedInputs = inputs.filter(i => i.name === payload.questionId || i.id === payload.questionId);
      if (namedInputs.length > 0) {
        inputs = namedInputs;
      }
    }

    for (const input of inputs) {
      if (!isElementVisible(input)) continue;

      // Find associated label — multiple strategies for cramped layouts
      let label: HTMLElement | null = null;
      let labelText = '';

      // Priority 1: aria-labelledby (Moodle uses this for radio buttons)
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      if (ariaLabelledBy) {
        const labelEl = document.getElementById(ariaLabelledBy);
        if (labelEl) {
          labelText = normalizeText(labelEl.textContent ?? '');
          label = labelEl;
        }
      }

      // Priority 2: label[for="id"]
      if (!labelText && input.id) {
        const forLabel = document.querySelector<HTMLElement>(`label[for="${escapeSelectorValue(input.id)}"]`);
        if (forLabel) {
          labelText = normalizeText(forLabel.textContent ?? '');
          label = forLabel;
        }
      }

      // Priority 3: closest label
      if (!labelText) {
        const closestLabel = input.closest('label');
        if (closestLabel) {
          labelText = normalizeText(closestLabel.textContent ?? '');
          label = closestLabel;
        }
      }

      // Priority 4: Moodle answer-row div (.r0, .r1 etc.) — isolate this option's container
      if (!labelText) {
        const answerRow = input.closest('div[class*="r"], div.option, div.answer-option, .flex-fill');
        if (answerRow && answerRow !== searchRoot) {
          labelText = normalizeText(answerRow.textContent ?? '');
          label = answerRow as HTMLElement;
        }
      }

      // Priority 5: TreeWalker — isolate text between THIS input and the NEXT input
      // This handles cramped layouts where two options share the same parent element
      if (!labelText) {
        const parent = input.parentElement;
        if (parent) {
          const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, null);
          let foundInput = false;
          const textParts: string[] = [];
          let node: Node | null;

          // Walk through all text nodes, collecting text after this input until the next input
          while ((node = walker.nextNode())) {
            // Check if we've passed this input
            if (!foundInput) {
              if (node.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING) continue;
              foundInput = true;
            }

            // Check if we've reached the next radio/checkbox input
            const nextInput = parent.querySelector<HTMLInputElement>(
              `input[type="radio"], input[type="checkbox"]`
            );
            if (nextInput && nextInput !== input) {
              // Check if the text node is AFTER the next input
              const siblings = Array.from(parent.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
              const myIdx = siblings.indexOf(input);
              const nextSibling = siblings[myIdx + 1];
              if (nextSibling && !(node.compareDocumentPosition(nextSibling) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                break;
              }
            }

            const t = (node.textContent ?? '').trim();
            if (t.length > 0) textParts.push(t);
          }

          const isolatedText = textParts.join(' ').trim();
          if (isolatedText.length > 0 && isolatedText.length < 500) {
            labelText = normalizeText(isolatedText);
            label = parent;
          }
        }
      }

      // Priority 6: Last resort — parent text (may be merged for cramped layouts)
      if (!labelText) {
        const parent = input.parentElement;
        if (parent) {
          const text = normalizeText(parent.textContent ?? '');
          if (text.length > 0 && text.length < 500) {
            labelText = text;
            label = parent;
          }
        }
      }

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

    // Deduplication: Use a composite key that includes the input's unique value
    // so that two radio buttons with identical label text (e.g. options A and D
    // both showing "$this->load->database();") are kept as separate entries.
    const filteredClickables = Array.from(
      new Map(
        clickables
          .filter((clickable) => !isIgnoredClickableText(clickable.text))
          .map((clickable) => {
            const inputId = clickable.input?.id || '';
            const inputName = clickable.input?.name || '';
            const inputValue = clickable.input?.value || '';
            // Build a truly unique key per input element
            const inputKey = inputId
              ? `id:${inputId}`
              : (inputName && inputValue)
                ? `nv:${inputName}:${inputValue}`
                : clickable.normalized;
            return [`${inputKey}::${clickable.normalized}`, clickable] as const;
          }),
      ).values(),
    );

    if (filteredClickables.length === 0) {
      return { clicked: false, clickedText: null, matchMethod: 'no_clickables_found' };
    }

    // Match priority: raw exact → normalized exact → lowercase → strict starts_with → strict contains → strict fuzzy
    // STRICT MATCHING: For multiple choice, only accept a match if there's a strong
    // correspondence. If no good match exists, SKIP the question instead of guessing.
    function findBestClickableForText(matchText: string) {
      const normalizedMatch = normalizeForMatch(matchText);
      const lowerMatch = matchText.trim().toLowerCase();
      // Raw trimmed text preserving all original characters (for C#, C++ matching)
      const rawTrimmed = matchText.trim();

      if (!normalizedMatch && !rawTrimmed) {
        return { bestMatch: null as (typeof filteredClickables)[number] | null, matchMethod: 'empty' };
      }

      let bestMatch: (typeof filteredClickables)[number] | null = null;
      let matchMethod = 'none';

      // 0. RAW exact match (case-insensitive, preserves special chars like C#, C++)
      // This is critical for short answers with special characters
      for (const c of filteredClickables) {
        const rawChoiceText = c.text.replace(/^[a-e]\.\s+/i, '').replace(/^\d+\.\s+/, '').trim();
        if (rawChoiceText.toLowerCase() === rawTrimmed.toLowerCase()) {
          bestMatch = c;
          matchMethod = 'raw_exact';
          break;
        }
      }

      // 1. Exact normalized match
      if (!bestMatch) {
        for (const c of filteredClickables) {
          if (c.normalized === normalizedMatch) {
            bestMatch = c;
            matchMethod = 'exact';
            break;
          }
        }
      }

      // 2. Lowercase trimmed match
      if (!bestMatch) {
        for (const c of filteredClickables) {
          if (c.text.trim().toLowerCase() === lowerMatch) {
            bestMatch = c;
            matchMethod = 'lowercase';
            break;
          }
        }
      }

      // 3. Strict starts_with — only accept if overlap ratio is ≥ 80%
      // Prevents "SAN Management" from matching "SAN Management, RAID Arrays and Tape drives"
      if (!bestMatch) {
        for (const c of filteredClickables) {
          if (normalizedMatch.startsWith(c.normalized) || c.normalized.startsWith(normalizedMatch)) {
            const shorter = Math.min(normalizedMatch.length, c.normalized.length);
            const longer = Math.max(normalizedMatch.length, c.normalized.length);
            const ratio = longer > 0 ? shorter / longer : 0;
            if (ratio >= 0.8) {
              bestMatch = c;
              matchMethod = 'starts_with';
              break;
            }
          }
        }
      }

      // 4. Strict contains — only accept if the contained portion covers ≥ 80% of the containing text
      if (!bestMatch) {
        for (const c of filteredClickables) {
          if (c.normalized.includes(normalizedMatch) || normalizedMatch.includes(c.normalized)) {
            const shorter = Math.min(normalizedMatch.length, c.normalized.length);
            const longer = Math.max(normalizedMatch.length, c.normalized.length);
            const ratio = longer > 0 ? shorter / longer : 0;
            if (ratio >= 0.8) {
              bestMatch = c;
              matchMethod = 'contains';
              break;
            }
          }
        }
      }

      // 5. Strict fuzzy: require ≥ 85% word overlap for radio/multiple-choice
      // This prevents selecting a partial match (e.g. only first few words match)
      if (!bestMatch) {
        const targetWords = normalizedMatch.split(/\s+/).filter((word) => word.length > 2);
        let bestScore = 0;

        for (const c of filteredClickables) {
          const choiceWords = new Set(c.normalized.split(/\s+/));
          const matchCount = targetWords.filter((word) => choiceWords.has(word)).length;
          const score = targetWords.length > 0 ? matchCount / targetWords.length : 0;

          // Also check reverse: what fraction of choice words appear in the target
          const choiceWordsList = c.normalized.split(/\s+/).filter((w) => w.length > 2);
          const reverseMatches = choiceWordsList.filter((w) => normalizedMatch.includes(w)).length;
          const reverseScore = choiceWordsList.length > 0 ? reverseMatches / choiceWordsList.length : 0;

          // Both directions must be strong to accept a fuzzy match
          const combinedScore = Math.min(score, reverseScore);

          if (combinedScore > bestScore && combinedScore >= 0.85) {
            bestScore = combinedScore;
            bestMatch = c;
            matchMethod = 'fuzzy';
          }
        }
      }

      return { bestMatch, matchMethod };
    }

    const hasCheckboxChoices = filteredClickables.some((clickable) => clickable.input?.type === 'checkbox') || knownType === 'checkbox';
    
    // ─── Build multi-answer segments for checkbox questions ───
    // Try multiple splitting strategies in priority order:
    // 1. Newline-separated (most common when answers are stored per-line in Q&A library)
    // 2. Bullet/dot-separated 
    // 3. Pipe-delimited
    // 4. General splitAnswerSegments (comma, semicolon, "and", etc.)
    let multiAnswerSegments: string[] = [];
    const rawAnswer = payload.answerText || targetText;

    if (hasCheckboxChoices || knownType === 'checkbox') {
      // Strategy 1: newline-separated (library stores each answer on its own line)
      const newlineSegments = rawAnswer.split(/\n+/).map(s => s.trim()).filter(s => s.length >= 2);
      if (newlineSegments.length >= 2) {
        multiAnswerSegments = newlineSegments;
      }

      // Strategy 2: bullet/dash lines ("• Grid Computing\n• Utility Computing")
      if (multiAnswerSegments.length < 2) {
        const bulletSegments = rawAnswer.split(/[\n•\-–—]+/).map(s => s.trim()).filter(s => s.length >= 2);
        if (bulletSegments.length >= 2) {
          multiAnswerSegments = bulletSegments;
        }
      }

      // Strategy 3: pipe-delimited
      if (multiAnswerSegments.length < 2) {
        const pipeSegments = rawAnswer.split(' | ').map(s => s.trim()).filter(Boolean);
        if (pipeSegments.length >= 2) {
          multiAnswerSegments = pipeSegments;
        }
      }

      // Strategy 4: General splitting (comma, semicolon, "and", &)
      if (multiAnswerSegments.length < 2) {
        multiAnswerSegments = splitAnswerSegments(rawAnswer);
      }

      // Strategy 5: If answer text contains choice labels as substrings (no delimiter)
      // e.g. "Grid Computing Utility Computing Cloud Computing" -- handled by containedCheckboxMatches below
    } else {
      multiAnswerSegments = splitAnswerSegments(rawAnswer);
    }

    if (hasCheckboxChoices && multiAnswerSegments.length >= 2) {
      const matchedSegments = multiAnswerSegments
        .map((segment) => {
          const result = findBestClickableForText(segment);
          return result.bestMatch
            ? {
                match: result.bestMatch,
              }
            : null;
        })
        .filter((entry): entry is { match: (typeof filteredClickables)[number] } => Boolean(entry));

      const distinctMatches = Array.from(
        new Map(
          matchedSegments.map((entry) => {
            const inputKey = entry.match.input
              ? entry.match.input.id || entry.match.input.name || entry.match.input.value || entry.match.normalized
              : entry.match.normalized;
            return [inputKey, entry] as const;
          }),
        ).values(),
      );

      // Click all matched checkboxes as long as at least 2 matched
      // (no longer requires ALL segments to match)
      if (distinctMatches.length >= 2) {
        try {
          for (const entry of distinctMatches) {
            if (entry.match.input) {
              if (!entry.match.input.checked) {
                entry.match.input.focus();
                entry.match.input.click();
                entry.match.input.dispatchEvent(new Event('change', { bubbles: true }));
                entry.match.input.dispatchEvent(new Event('input', { bubbles: true }));
              }
            } else {
              entry.match.element.click();
            }
          }

          return {
            clicked: true,
            clickedText: distinctMatches.map((entry) => entry.match.text).join(', '),
            matchMethod: 'checkbox_multi',
          };
        } catch {
          return {
            clicked: false,
            clickedText: distinctMatches.map((entry) => entry.match.text).join(', '),
            matchMethod: 'checkbox_multi_error',
          };
        }
      }
    }

    // Strategy for concatenated answers without commas (e.g. "Software as a Service Utility Computing Cloud Computing Grid Computing")
    // Check which checkbox choice labels appear as substrings within the raw answer text
    if (hasCheckboxChoices && multiAnswerSegments.length < 2) {
      const answerLower = normalizeForMatch(payload.answerText || targetText);
      const containedCheckboxMatches = filteredClickables.filter((clickable) => {
        if (clickable.input?.type !== 'checkbox') return false;
        const choiceNorm = clickable.normalized;
        // Choice must be at least 4 chars to avoid false positives
        if (!choiceNorm || choiceNorm.length < 4) return false;
        return answerLower.includes(choiceNorm) || choiceNorm.includes(answerLower);
      });

      if (containedCheckboxMatches.length >= 2) {
        try {
          for (const match of containedCheckboxMatches) {
            if (match.input && !match.input.checked) {
              match.input.focus();
              match.input.click();
              match.input.dispatchEvent(new Event('change', { bubbles: true }));
              match.input.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (!match.input) {
              match.element.click();
            }
          }

          return {
            clicked: true,
            clickedText: containedCheckboxMatches.map((m) => m.text).join(', '),
            matchMethod: 'checkbox_contained',
          };
        } catch {
          return {
            clicked: false,
            clickedText: containedCheckboxMatches.map((m) => m.text).join(', '),
            matchMethod: 'checkbox_contained_error',
          };
        }
      }
    }

    if (hasCheckboxChoices && targetText.includes(' | ')) {
      const pipedSegments = targetText.split(' | ').map((s) => s.trim()).filter(Boolean);
      if (pipedSegments.length >= 2) {
        const matchedSegments = pipedSegments
          .map((segment) => findBestClickableForText(segment))
          .filter((result) => result.bestMatch)
          .map((result) => result.bestMatch!);

        const distinctMatches = Array.from(
          new Map(
            matchedSegments.map((match) => {
              const inputKey = match.input
                ? match.input.id || match.input.name || match.input.value || match.normalized
                : match.normalized;
              return [inputKey, match] as const;
            })
          ).values()
        );

        if (distinctMatches.length > 0) {
          try {
            for (const match of distinctMatches) {
              if (match.input) {
                if (!match.input.checked) {
                  match.input.focus();
                  match.input.click();
                  match.input.dispatchEvent(new Event('change', { bubbles: true }));
                  match.input.dispatchEvent(new Event('input', { bubbles: true }));
                }
              } else {
                match.element.click();
              }
            }

            return {
              clicked: true,
              clickedText: distinctMatches.map((m) => m.text).join(' | '),
              matchMethod: 'checkbox_multi_piped',
            };
          } catch {
            return {
              clicked: false,
              clickedText: distinctMatches.map((m) => m.text).join(' | '),
              matchMethod: 'checkbox_multi_piped_error',
            };
          }
        }
      }
    }

    const { bestMatch, matchMethod } = findBestClickableForText(targetText);
    if (!bestMatch) {
      return { clicked: false, clickedText: null, matchMethod: 'no_match' };
    }

    try {
      if (bestMatch.input && !bestMatch.input.checked) {
        // Simulate a full user interaction: mousedown → mouseup → click → change
        // Some Moodle themes require the full event chain to register the selection
        bestMatch.input.focus();
        bestMatch.input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        bestMatch.input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        bestMatch.input.click();
        bestMatch.input.checked = true; // Force the checked state
        bestMatch.input.dispatchEvent(new Event('change', { bubbles: true }));
        bestMatch.input.dispatchEvent(new Event('input', { bubbles: true }));

        // Also click the label element if available — Moodle sometimes only responds to label clicks
        if (bestMatch.input.id) {
          try {
            const label = document.querySelector<HTMLElement>(`label[for="${CSS.escape(bestMatch.input.id)}"]`);
            if (label) label.click();
          } catch {
            // ignore label click errors
          }
        }
      } else if (!bestMatch.input) {
        bestMatch.element.click();
      }

      return { clicked: true, clickedText: bestMatch.text, matchMethod };
    } catch {
      return { clicked: false, clickedText: bestMatch.text, matchMethod: 'click_error' };
    }
  }
}
