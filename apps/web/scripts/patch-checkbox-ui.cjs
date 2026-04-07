// Patch admin-source-manager.tsx Checkbox UI
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'features', 'admin', 'admin-source-manager.tsx');
let c = fs.readFileSync(filePath, 'utf-8');

// 1. Add lucide-react imports if missing
if (!c.includes("import { Plus, XCircle, GripVertical } from 'lucide-react';")) {
  c = c.replace(
    "import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from '@study-assistant/ui';",
    "import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from '@study-assistant/ui';\nimport { Plus, XCircle, GripVertical } from 'lucide-react';"
  );
}

// 2. Add visual bullet list rendering to card view
const pairCardAnswerOld = `<p className="whitespace-pre-wrap text-[15px] cursor-text selection:bg-accent/30 leading-relaxed text-foreground font-medium pl-8">{pair.answer_text}</p>`;
const pairCardAnswerNew = `                                      {pair.question_type === 'checkbox' ? (
                                        <ul className="pl-12 space-y-2 mt-1">
                                          {(pair.answer_text || '').split(' | ').filter(Boolean).map((ans, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                              <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-accent/60" />
                                              <span className="text-[15px] leading-snug font-medium text-foreground">{ans.trim()}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="whitespace-pre-wrap text-[15px] cursor-text selection:bg-accent/30 leading-relaxed text-foreground font-medium pl-8">
                                          {pair.answer_text}
                                        </p>
                                      )}`;

if (c.includes(pairCardAnswerOld)) {
  c = c.replace(pairCardAnswerOld, pairCardAnswerNew);
  console.log('Patched Pair Card View');
}

// 3. Patch Inline Editor
const inlineAnswerOld = `                                      <Textarea
                                        value={inlineEditor.answerText}
                                        onChange={(event) => setInlineEditor((current) => (current ? { ...current, answerText: event.target.value } : current))}
                                        className="min-h-[100px] border-none bg-transparent resize-none p-0 focus-visible:ring-0"
                                      />`;
const inlineAnswerNew = `                                      {inlineEditor.questionType === 'checkbox' ? (
                                        <div className="space-y-2 mt-2">
                                          {(inlineEditor.answerText || '').split(' | ').map((ans, i, arr) => (
                                            <div key={i} className="flex gap-2 items-center">
                                              <span className="text-muted-foreground/50 opacity-50"><GripVertical size={14} /></span>
                                              <Input
                                                type="text"
                                                value={ans}
                                                placeholder={\`Checkbox answer option \${i + 1}\`}
                                                className="h-8 text-sm bg-background/50"
                                                onChange={(e) => {
                                                  const nextArr = [...arr];
                                                  nextArr[i] = e.target.value;
                                                  setInlineEditor((current) => (current ? { ...current, answerText: nextArr.join(' | ') } : current));
                                                }}
                                              />
                                              <button
                                                type="button"
                                                title="Remove this option"
                                                className="text-muted-foreground hover:text-danger p-1 rounded-md"
                                                onClick={() => {
                                                  const nextArr = arr.filter((_, idx) => idx !== i);
                                                  setInlineEditor((current) => (current ? { ...current, answerText: nextArr.join(' | ') } : current));
                                                }}
                                              >
                                                <XCircle size={16} />
                                              </button>
                                            </div>
                                          ))}
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                              const nextArr = [...(inlineEditor.answerText ? inlineEditor.answerText.split(' | ') : []), ''];
                                              setInlineEditor((current) => (current ? { ...current, answerText: nextArr.join(' | ') } : current));
                                            }}
                                            className="h-8 mt-2 w-full border-dashed flex items-center justify-center gap-1 text-muted-foreground"
                                          >
                                            <Plus size={14} /> Add option
                                          </Button>
                                        </div>
                                      ) : (
                                      <Textarea
                                        value={inlineEditor.answerText}
                                        onChange={(event) => setInlineEditor((current) => (current ? { ...current, answerText: event.target.value } : current))}
                                        className="min-h-[100px] border-none bg-transparent resize-none p-0 focus-visible:ring-0"
                                      />
                                      )}`;

if (c.includes(inlineAnswerOld)) {
  c = c.replace(inlineAnswerOld, inlineAnswerNew);
  console.log('Patched Inline Editor');
} else {
    // try removing newlines
    let noSpacesC = c.replace(/\s+/g, ' ');
    let noSpacesOld = inlineAnswerOld.replace(/\s+/g, ' ');
    if (noSpacesC.includes(noSpacesOld)) {
        console.log("Found inline answer with different spacing, manual patch needed");
    }
}

// 4. Patch Quick Add Editor
const quickAddOld = `                          <Textarea
                            value={editor.answerText}
                            onChange={(event) => setEditor((current) => ({ ...current, answerText: event.target.value }))}
                            placeholder="Enter the precise answer to be suggested..."
                            className="min-h-[100px] text-base resize-none"
                            disabled={!selectedRootFolder}
                          />`;
const quickAddNew = `                          {editor.questionType === 'checkbox' ? (
                            <div className="space-y-3 mt-1">
                              {(editor.answerText || '').split(' | ').map((ans, i, arr) => (
                                <div key={i} className="flex gap-2 items-center">
                                  <span className="text-muted-foreground/30"><GripVertical size={16} /></span>
                                  <Input
                                    type="text"
                                    value={ans}
                                    disabled={!selectedRootFolder}
                                    placeholder={\`Exact text for correct checkbox \${i + 1}\`}
                                    className="flex w-full rounded-md border border-input px-3 py-2 text-sm bg-background/50 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                    onChange={(e) => {
                                      const nextArr = [...arr];
                                      nextArr[i] = e.target.value;
                                      setEditor((c) => ({ ...c, answerText: nextArr.join(' | ') }));
                                    }}
                                  />
                                  <button
                                    type="button"
                                    disabled={!selectedRootFolder}
                                    onClick={() => {
                                      const nextArr = arr.filter((_, idx) => idx !== i);
                                      setEditor((c) => ({ ...c, answerText: nextArr.join(' | ') }));
                                    }}
                                    className="p-2 text-muted-foreground hover:text-danger rounded-md hover:bg-danger/10 transition-colors"
                                  >
                                    <XCircle size={18} />
                                  </button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={!selectedRootFolder}
                                onClick={() => {
                                  const nextArr = [...(editor.answerText ? editor.answerText.split(' | ') : []), ''];
                                  setEditor((c) => ({ ...c, answerText: nextArr.join(' | ') }));
                                }}
                                className="w-full mt-2 border-dashed border-2 flex items-center justify-center gap-2 text-muted-foreground"
                              >
                                <Plus size={16} /> Add another answer
                              </Button>
                            </div>
                          ) : (
                          <Textarea
                            value={editor.answerText}
                            onChange={(event) => setEditor((current) => ({ ...current, answerText: event.target.value }))}
                            placeholder="Enter the precise answer to be suggested..."
                            className="min-h-[100px] text-base resize-none"
                            disabled={!selectedRootFolder}
                          />
                          )}`;

if (c.includes(quickAddOld)) {
  c = c.replace(quickAddOld, quickAddNew);
  console.log('Patched Quick Add');
}


// Also update the description hint for Checkbox to no longer mention pipe delimiter
const hintOld = `💡 For checkbox answers, separate each correct answer with a pipe <code className="bg-muted px-1 rounded">|</code> character. Example: <code className="bg-muted px-1 rounded">Choice A | Choice B | Choice C</code>`;
const hintNew = `💡 Checkbox questions require multiple exact correct outputs. Use the 'Add another answer' button below to list them out.`;
if (c.includes(hintOld)) {
    c = c.replace(hintOld, hintNew);
    console.log('Patched hint');
}

fs.writeFileSync(filePath, c, 'utf-8');
console.log('File written.');
