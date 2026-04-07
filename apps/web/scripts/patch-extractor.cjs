// Patch extractor.ts to add questionType detection and type-aware auto-click
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', '..', '..', 'apps', 'extension', 'src', 'content', 'extractor.ts');
let c = fs.readFileSync(filePath, 'utf-8');
let changeCount = 0;

function replace(label, search, replacement) {
  if (!c.includes(search)) {
    console.log(`WARN: "${label}" target not found, skipping`);
    return;
  }
  c = c.replace(search, replacement);
  changeCount++;
  console.log(`OK: ${label}`);
}

// 1. Add questionType to createQuestionCandidate input and return
replace('createQuestionCandidate input type',
  `function createQuestionCandidate(input: {
    id: string;
    prompt: string | null;
    options: string[];
    contextLabel?: string | null;
  }) {`,
  `function createQuestionCandidate(input: {
    id: string;
    prompt: string | null;
    options: string[];
    contextLabel?: string | null;
    questionType?: string | null;
  }) {`
);

replace('createQuestionCandidate return',
  `    return {
      id: input.id,
      prompt: prompt.slice(0, 500),
      options: normalizedOptions.slice(0, MAX_EXTRACTED_OPTIONS),
      contextLabel: input.contextLabel ? normalizeText(input.contextLabel).slice(0, 120) : null,
    };
  }`,
  `    return {
      id: input.id,
      prompt: prompt.slice(0, 500),
      options: normalizedOptions.slice(0, MAX_EXTRACTED_OPTIONS),
      contextLabel: input.contextLabel ? normalizeText(input.contextLabel).slice(0, 120) : null,
      questionType: input.questionType ?? null,
    };
  }`
);

// 2. Add questionType to candidate array type
replace('candidates array type',
  `    const candidates: Array<{
      id: string;
      prompt: string;
      options: string[];
      contextLabel: string | null;
    }> = [];`,
  `    const candidates: Array<{
      id: string;
      prompt: string;
      options: string[];
      contextLabel: string | null;
      questionType: string | null;
    }> = [];`
);

// 3. Add questionType to pushCandidate type
replace('pushCandidate type',
  `    function pushCandidate(candidate: {
      id: string;
      prompt: string;
      options: string[];
      contextLabel: string | null;
    } | null) {`,
  `    function pushCandidate(candidate: {
      id: string;
      prompt: string;
      options: string[];
      contextLabel: string | null;
      questionType: string | null;
    } | null) {`
);

// 4. Add a detectQuestionType helper function right before extractQuestionCandidates
replace('add detectQuestionType helper',
  `  function extractQuestionCandidates() {`,
  `  /** Detect the question type from the DOM container */
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
    const qtext = container.querySelector('.qtext, .questiontext, .question-text, .prompt');
    if (qtext && qtext.querySelector('img')) return 'picture';

    // Default: multiple choice (radio buttons or generic)
    return 'multiple_choice';
  }

  function extractQuestionCandidates() {`
);

// Now I need to find each call to createQuestionCandidate and add the questionType.
// There are 5 calls. Let me patch each one by looking for unique context:

// 5a. First call (explicit question blocks with radio/checkbox) ~line 933
// The container is available as 'container' from the for loop
replace('createQuestionCandidate call 1 - explicit blocks',
  `        pushCandidate(
          createQuestionCandidate({
            id: containerId,
            prompt,
            options,
            contextLabel: questionLabel,
          }),
        );

        structuredContainers.add(containerId);`,
  `        pushCandidate(
          createQuestionCandidate({
            id: containerId,
            prompt,
            options,
            contextLabel: questionLabel,
            questionType: detectQuestionType(container),
          }),
        );

        structuredContainers.add(containerId);`
);

// 5b. Second call (structured containers with prompt nodes) ~line 960
replace('createQuestionCandidate call 2 - structured containers',
  `          pushCandidate(
            createQuestionCandidate({
              id: structuredContainerId,
              prompt: promptCandidate?.text ?? combinedPromptText,
              options: structuredOptions,
              contextLabel: structuredLabel,
            }),
          );`,
  `          pushCandidate(
            createQuestionCandidate({
              id: structuredContainerId,
              prompt: promptCandidate?.text ?? combinedPromptText,
              options: structuredOptions,
              contextLabel: structuredLabel,
              questionType: detectQuestionType(structuredContainer),
            }),
          );`
);

// 5c. Third call (grouped input blocks) ~line 1017
replace('createQuestionCandidate call 3 - grouped inputs',
  `        pushCandidate(
          createQuestionCandidate({
            id: groupInputContainerId,
            prompt: groupInputPrompt,
            options: groupInputOptions,
            contextLabel: groupInputLabel,
          }),
        );`,
  `        pushCandidate(
          createQuestionCandidate({
            id: groupInputContainerId,
            prompt: groupInputPrompt,
            options: groupInputOptions,
            contextLabel: groupInputLabel,
            questionType: detectQuestionType(groupInputContainer),
          }),
        );`
);

// 5d. Fourth call (freeform inputs) ~line 1058
replace('createQuestionCandidate call 4 - freeform inputs',
  `        pushCandidate(
          createQuestionCandidate({
            id: freeformContainerId,
            prompt: freeformPrompt,
            options: [],
            contextLabel: freeformLabel,
          }),
        );`,
  `        pushCandidate(
          createQuestionCandidate({
            id: freeformContainerId,
            prompt: freeformPrompt,
            options: [],
            contextLabel: freeformLabel,
            questionType: 'fill_in_blank',
          }),
        );`
);

// 5e. Fifth call (dropdown sub-questions) ~line 1254
replace('createQuestionCandidate call 5 - dropdown sub-questions',
  `          pushCandidate(
            createQuestionCandidate({
              id: subId,
              prompt: subPrompt,
              options: selectOptions,
              contextLabel: subContextLabel,
            }),
          );`,
  `          pushCandidate(
            createQuestionCandidate({
              id: subId,
              prompt: subPrompt,
              options: selectOptions,
              contextLabel: subContextLabel,
              questionType: 'dropdown',
            }),
          );`
);

// 6. Update autoClickAnswer to accept and use questionType
replace('autoClickAnswer signature',
  `  function autoClickAnswer(payload: {
    questionId: string;
    answerText: string;
    suggestedOption: string | null;
    options: string[];
  }): { clicked: boolean; clickedText: string | null; matchMethod: string } {`,
  `  function autoClickAnswer(payload: {
    questionId: string;
    answerText: string;
    suggestedOption: string | null;
    options: string[];
    questionType?: string | null;
  }): { clicked: boolean; clickedText: string | null; matchMethod: string } {`
);

// 7. Update the message handler to pass questionType
replace('AUTO_CLICK_ANSWER payload type',
  `    if (message?.type === 'EXTENSION/AUTO_CLICK_ANSWER') {
      const payload = message.payload as {
        questionId: string;
        answerText: string;
        suggestedOption: string | null;
        options: string[];
      };`,
  `    if (message?.type === 'EXTENSION/AUTO_CLICK_ANSWER') {
      const payload = message.payload as {
        questionId: string;
        answerText: string;
        suggestedOption: string | null;
        options: string[];
        questionType?: string | null;
      };`
);

// 8. Add type-aware routing at the start of autoClickAnswer
// After the setControlValue function and targetText check, add type routing
replace('type-aware routing',
  `    const targetText = payload.suggestedOption ?? payload.answerText;
    if (!targetText) {
      return { clicked: false, clickedText: null, matchMethod: 'no_answer' };
    }

    // Scope to the specific question container if available
    const scopedContainer = document.querySelector(\`[data-study-assistant-id="\${escapeSelectorValue(payload.questionId)}"]\`);
    const searchRoot = scopedContainer ?? document;

    // ═══════════════════════════════════════════════════════════════
    // Strategy A: Fill-in-the-blank — text inputs and textareas
    // ═══════════════════════════════════════════════════════════════`,
  `    const targetText = payload.suggestedOption ?? payload.answerText;
    if (!targetText) {
      return { clicked: false, clickedText: null, matchMethod: 'no_answer' };
    }

    // Scope to the specific question container if available
    const scopedContainer = document.querySelector(\`[data-study-assistant-id="\${escapeSelectorValue(payload.questionId)}"]\`);
    const searchRoot = scopedContainer ?? document;
    
    // ═══════════════════════════════════════════════════════════════
    // Type-aware routing: use backend questionType to skip irrelevant strategies
    // ═══════════════════════════════════════════════════════════════
    const knownType = payload.questionType ?? null;

    // ═══════════════════════════════════════════════════════════════
    // Strategy A: Fill-in-the-blank — text inputs and textareas
    // ═══════════════════════════════════════════════════════════════`
);

// 9. Add type-aware skip for fill-in-blank when type is known to be radio/dropdown
// Before Strategy A execution, add a guard
replace('skip fill-in-blank for known types',
  `    // For fill-in-the-blank: if there's exactly 1 text input in the question,`,
  `    // Skip fill-in-blank strategy if we know this is a radio/checkbox/dropdown question
    if (knownType && knownType !== 'fill_in_blank' && knownType !== 'picture') {
      // Skip to the appropriate strategy
    } else if (false) {
      // placeholder
    } else
    // For fill-in-the-blank: if there's exactly 1 text input in the question,`
);

// 10. For checkbox type from backend, also try pipe-delimited split first
replace('checkbox pipe split enhancement',
  `    const hasCheckboxChoices = filteredClickables.some((clickable) => clickable.input?.type === 'checkbox');
    const multiAnswerSegments = splitAnswerSegments(payload.answerText || targetText);`,
  `    const hasCheckboxChoices = filteredClickables.some((clickable) => clickable.input?.type === 'checkbox') || knownType === 'checkbox';
    
    // When backend says this is a checkbox question, also try pipe-delimited split
    let multiAnswerSegments = splitAnswerSegments(payload.answerText || targetText);
    if (knownType === 'checkbox' && multiAnswerSegments.length < 2) {
      // Try pipe delimiter explicitly for type-aware checkbox handling
      const pipeSegments = (payload.answerText || targetText).split(' | ').map(s => s.trim()).filter(Boolean);
      if (pipeSegments.length >= 2) {
        multiAnswerSegments = pipeSegments;
      }
    }`
);

fs.writeFileSync(filePath, c, 'utf-8');
console.log(`\nPatched extractor.ts with ${changeCount} changes`);

// Verify
const patched = fs.readFileSync(filePath, 'utf-8');
const qtCount = (patched.match(/questionType/g) || []).length;
const detectCount = (patched.match(/detectQuestionType/g) || []).length;
console.log(`Found ${qtCount} occurrences of 'questionType'`);
console.log(`Found ${detectCount} occurrences of 'detectQuestionType'`);
