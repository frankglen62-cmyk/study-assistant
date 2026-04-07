// Patch admin-source-manager.tsx to add questionType support
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'features', 'admin', 'admin-source-manager.tsx');
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

// 1. Add QuestionType import
replace('import QuestionType',
  "} from '@study-assistant/shared-types';",
  "  QuestionType,\n} from '@study-assistant/shared-types';"
);

// 2. Add questionType to QaEditorState
replace('QaEditorState questionType',
  '  isActive: boolean;\r\n}\r\n\r\ninterface JsonErrorPayload',
  '  isActive: boolean;\r\n  questionType: QuestionType;\r\n  questionImageUrl: string;\r\n}\r\n\r\ninterface JsonErrorPayload'
);

// 3. Add questionType to buildEmptyEditor
replace('buildEmptyEditor questionType',
  "    isActive: true,\r\n  };\r\n}\r\n\r\nfunction getNextSortOrder",
  "    isActive: true,\r\n    questionType: 'multiple_choice' as QuestionType,\r\n    questionImageUrl: '',\r\n  };\r\n}\r\n\r\nconst QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string; icon: string }[] = [\r\n  { value: 'multiple_choice', label: 'Multiple Choice', icon: '🔘' },\r\n  { value: 'checkbox', label: 'Checkbox', icon: '☑️' },\r\n  { value: 'fill_in_blank', label: 'Fill in the Blank', icon: '✏️' },\r\n  { value: 'dropdown', label: 'Dropdown', icon: '📋' },\r\n  { value: 'picture', label: 'Picture Question', icon: '🖼️' },\r\n];\r\n\r\nfunction getQuestionTypeBadge(qt: string) {\r\n  const opt = QUESTION_TYPE_OPTIONS.find(o => o.value === qt);\r\n  return opt ? `${opt.icon} ${opt.label}` : '🔘 MC';\r\n}\r\n\r\nfunction getNextSortOrder"
);

// 4. Add questionType to mapSummaryToRecord
replace('mapSummaryToRecord questionType',
  '    categories: summary.categoryName ? { name: summary.categoryName } : null,\n  };\n}',
  "    question_type: summary.questionType ?? 'multiple_choice',\n    question_image_url: summary.questionImageUrl ?? null,\n    categories: summary.categoryName ? { name: summary.categoryName } : null,\n  };\n}"
);

// 5. Add questionType to buildEditorFromPair
replace('buildEditorFromPair questionType',
  "      isActive: pair.is_active,\r\n    };\r\n  }\r\n\r\n  useEffect(() =>",
  "      isActive: pair.is_active,\r\n      questionType: (pair.question_type ?? 'multiple_choice') as QuestionType,\r\n      questionImageUrl: pair.question_image_url ?? '',\r\n    };\r\n  }\r\n\r\n  useEffect(() =>"
);

// 6. Add questionType to basePayload in savePairDraft
replace('basePayload questionType',
  '        isActive: draft.isActive,\r\n      };\r\n\r\n      const response = await fetch(',
  "        isActive: draft.isActive,\r\n        questionType: draft.questionType ?? 'multiple_choice',\r\n        questionImageUrl: draft.questionImageUrl || null,\r\n      };\r\n\r\n      const response = await fetch("
);

// 7. Add questionType to nextPair in savePairDraft
replace('nextPair questionType',
  "        is_active: draft.isActive,\r\n        deleted_at: null,\r\n        updated_at: new Date().toISOString(),\r\n        subjects: {\r\n          name: selectedSubject.name,\r\n        },\r\n        categories: null,\r\n      };",
  "        is_active: draft.isActive,\r\n        question_type: draft.questionType ?? 'multiple_choice',\r\n        question_image_url: draft.questionImageUrl || null,\r\n        deleted_at: null,\r\n        updated_at: new Date().toISOString(),\r\n        subjects: {\r\n          name: selectedSubject.name,\r\n        },\r\n        categories: null,\r\n      };"
);

fs.writeFileSync(filePath, c, 'utf-8');
console.log(`\nPatched admin-source-manager.tsx with ${changeCount} changes`);

// Verify
const patched = fs.readFileSync(filePath, 'utf-8');
const qtCount = (patched.match(/questionType/g) || []).length;
console.log(`Found ${qtCount} occurrences of 'questionType'`);
