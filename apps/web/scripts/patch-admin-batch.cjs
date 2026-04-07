// Patch admin-source-manager.tsx to fix the batch pairs questionType compilation error
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'features', 'admin', 'admin-source-manager.tsx');
let c = fs.readFileSync(filePath, 'utf-8');

c = c.replace(
  /const newPairs: SubjectQaPairRecord\[\] = \(result\.pairIds \?\? \[\]\)\.map\(\(pairId: string, i: number\) => \(\{\r?\n(\s+)id: pairId,\r?\n(\s+)subject_id: selectedSubject\.id,\r?\n(\s+)category_id: null,/,
  `const newPairs: SubjectQaPairRecord[] = (result.pairIds ?? []).map((pairId: string, i: number) => ({\r\n$1id: pairId,\r\n$2subject_id: selectedSubject.id,\r\n$3category_id: null,\r\n$3question_type: 'multiple_choice',\r\n$3question_image_url: null,`
);

fs.writeFileSync(filePath, c, 'utf-8');
console.log('Fixed newPairs structure in admin-source-manager.tsx');
