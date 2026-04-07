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

// 1. Line 961 - structured containers
replace('Call 1 - structured',
  `        pushCandidate(
          createQuestionCandidate({
            id: containerId,
            prompt,
            options: extractOptionsFromContainer(container),
            contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),
          }),
        );`.replace(/\n/g, '\r\n'),
  `        pushCandidate(
          createQuestionCandidate({
            id: containerId,
            prompt,
            options: extractOptionsFromContainer(container),
            contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),
            questionType: detectQuestionType(container),
          }),
        );`.replace(/\n/g, '\r\n')
);
if(changeCount === 0) { // Fallback standard linux line endings just in case
    replace('Call 1 - structured (LF)',
      `        pushCandidate(\n          createQuestionCandidate({\n            id: containerId,\n            prompt,\n            options: extractOptionsFromContainer(container),\n            contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),\n          }),\n        );`,
      `        pushCandidate(\n          createQuestionCandidate({\n            id: containerId,\n            prompt,\n            options: extractOptionsFromContainer(container),\n            contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),\n            questionType: detectQuestionType(container),\n          }),\n        );`
    );
}

// 2. Line 988 - explicit blocks
replace('Call 2 - explicit blocks',
  `        pushCandidate(\n          createQuestionCandidate({\n            id,\n            prompt: derivePromptFromContainer(element),\n            options: extractOptionsFromContainer(element),\n            contextLabel: element.dataset.questionLabel ?? null,\n          }),\n        );`.replace(/\n/g, '\r\n'),
  `        pushCandidate(\n          createQuestionCandidate({\n            id,\n            prompt: derivePromptFromContainer(element),\n            options: extractOptionsFromContainer(element),\n            contextLabel: element.dataset.questionLabel ?? null,\n            questionType: detectQuestionType(element),\n          }),\n        );`.replace(/\n/g, '\r\n')
);
replace('Call 2 - explicit blocks (LF)',
  `        pushCandidate(\n          createQuestionCandidate({\n            id,\n            prompt: derivePromptFromContainer(element),\n            options: extractOptionsFromContainer(element),\n            contextLabel: element.dataset.questionLabel ?? null,\n          }),\n        );`,
  `        pushCandidate(\n          createQuestionCandidate({\n            id,\n            prompt: derivePromptFromContainer(element),\n            options: extractOptionsFromContainer(element),\n            contextLabel: element.dataset.questionLabel ?? null,\n            questionType: detectQuestionType(element),\n          }),\n        );`
);

// 3. Line 1045 - grouped inputs
replace('Call 3 - grouped inputs',
  `      pushCandidate(\n        createQuestionCandidate({\n          id,\n          prompt: derivePromptFromContainer(container) ?? derivePromptNearInputs(inputs),\n          options: inputs.map((input) => extractOptionLabel(input)).filter(Boolean),\n          contextLabel:\n            (container instanceof HTMLElement ? container.dataset.questionLabel ?? null : null) ??\n            deriveQuestionLabel(container),\n        }),\n      );`.replace(/\n/g, '\r\n'),
  `      pushCandidate(\n        createQuestionCandidate({\n          id,\n          prompt: derivePromptFromContainer(container) ?? derivePromptNearInputs(inputs),\n          options: inputs.map((input) => extractOptionLabel(input)).filter(Boolean),\n          contextLabel:\n            (container instanceof HTMLElement ? container.dataset.questionLabel ?? null : null) ??\n            deriveQuestionLabel(container),\n          questionType: container instanceof HTMLElement ? detectQuestionType(container) : 'multiple_choice',\n        }),\n      );`.replace(/\n/g, '\r\n')
);
replace('Call 3 - grouped inputs (LF)',
  `      pushCandidate(\n        createQuestionCandidate({\n          id,\n          prompt: derivePromptFromContainer(container) ?? derivePromptNearInputs(inputs),\n          options: inputs.map((input) => extractOptionLabel(input)).filter(Boolean),\n          contextLabel:\n            (container instanceof HTMLElement ? container.dataset.questionLabel ?? null : null) ??\n            deriveQuestionLabel(container),\n        }),\n      );`,
  `      pushCandidate(\n        createQuestionCandidate({\n          id,\n          prompt: derivePromptFromContainer(container) ?? derivePromptNearInputs(inputs),\n          options: inputs.map((input) => extractOptionLabel(input)).filter(Boolean),\n          contextLabel:\n            (container instanceof HTMLElement ? container.dataset.questionLabel ?? null : null) ??\n            deriveQuestionLabel(container),\n          questionType: container instanceof HTMLElement ? detectQuestionType(container) : 'multiple_choice',\n        }),\n      );`
);

// 4. Line 1086 - freeform
replace('Call 4 - freeform',
  `      pushCandidate(\n        createQuestionCandidate({\n          id,\n          prompt: derivePromptFromContainer(container),\n          options: [],\n          contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),\n        }),\n      );`.replace(/\n/g, '\r\n'),
  `      pushCandidate(\n        createQuestionCandidate({\n          id,\n          prompt: derivePromptFromContainer(container),\n          options: [],\n          contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),\n          questionType: 'fill_in_blank',\n        }),\n      );`.replace(/\n/g, '\r\n')
);
replace('Call 4 - freeform (LF)',
  `      pushCandidate(\n        createQuestionCandidate({\n          id,\n          prompt: derivePromptFromContainer(container),\n          options: [],\n          contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),\n        }),\n      );`,
  `      pushCandidate(\n        createQuestionCandidate({\n          id,\n          prompt: derivePromptFromContainer(container),\n          options: [],\n          contextLabel: container.dataset.questionLabel ?? deriveQuestionLabel(container),\n          questionType: 'fill_in_blank',\n        }),\n      );`
);

fs.writeFileSync(filePath, c, 'utf-8');
console.log('Done!');
