// Patch analyze.ts to add questionType field in 5 places
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'lib', 'ai', 'analyze.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. sanitizeSignals: add questionType to candidate object
content = content.replace(
  /contextLabel: candidate\.contextLabel \? sanitizeText\(candidate\.contextLabel, 120\) : null,\r?\n(\s*)};/,
  'contextLabel: candidate.contextLabel ? sanitizeText(candidate.contextLabel, 120) : null,\r\n$1questionType: candidate.questionType ?? null,\r\n$1};'
);

// 2. deriveQuestionCandidates fallback: add questionType to fallback candidate
content = content.replace(
  /contextLabel: null,\r?\n(\s+)},\r?\n(\s+)\];/,
  'contextLabel: null,\r\n$1questionType: null,\r\n$1},\r\n$2];'
);

// 3. buildNoMatchQuestionSuggestion: add questionType
content = content.replace(
  /clickStatus: 'pending' as const,\r?\n(\s+)clickedText: null,\r?\n(\s+)} satisfies ExtensionQuestionSuggestion;/,
  "clickStatus: 'pending' as const,\r\n$1clickedText: null,\r\n$1questionType: null,\r\n$2} satisfies ExtensionQuestionSuggestion;"
);

// 4. resolveQuestionSuggestionFromPreloaded: add questionType from pair
content = content.replace(
  /sourceScope,\r?\n(\s+)clickStatus: 'pending' as const,\r?\n(\s+)clickedText: null,\r?\n(\s+)} satisfies ExtensionQuestionSuggestion;/,
  "sourceScope,\r\n$1clickStatus: 'pending' as const,\r\n$2clickedText: null,\r\n$2questionType: (pair).question_type ?? null,\r\n$3} satisfies ExtensionQuestionSuggestion;"
);

// 5. persistNoMatch fallback: add questionType  
content = content.replace(
  /sourceScope: 'no_match' as const,\r?\n(\s+)clickStatus: 'pending' as const,\r?\n(\s+)clickedText: null,\r?\n(\s+)}\)\);/,
  "sourceScope: 'no_match' as const,\r\n$1clickStatus: 'pending' as const,\r\n$2clickedText: null,\r\n$2questionType: null,\r\n$3}));"
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('analyze.ts patched successfully!');

// Verify
const patched = fs.readFileSync(filePath, 'utf-8');
const count = (patched.match(/questionType/g) || []).length;
console.log(`Found ${count} occurrences of 'questionType' in analyze.ts`);
