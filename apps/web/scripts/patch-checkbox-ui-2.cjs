const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'features', 'admin', 'admin-source-manager.tsx');
let c = fs.readFileSync(filePath, 'utf-8');

// 1. Quick Add Editor
const quickAddRegex = /<Textarea\s+value=\{editor\.answerText\}\s+onChange=\{\(event\) => setEditor\(\(current\) => \(\{ \.\.\.current, answerText: event\.target\.value \}\)\)\}\s+placeholder="Enter the precise answer to be suggested\.\.\."\s+className="min-h-\[100px\] text-base resize-none"\s+disabled=\{!selectedRootFolder\}\s+\/>/g;

const quickAddNew = `{editor.questionType === 'checkbox' ? (
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

let matchQA = quickAddRegex.exec(c);
if (matchQA){
    c = c.replace(matchQA[0], quickAddNew);
    console.log("Patched Quick Add");
} else {
    console.log("Could not find Quick Add textarea via regex.");
}

// 2. Inline Editor
const inlineRegex = /<Textarea\s+value=\{inlineEditor\.answerText\}\s+onChange=\{\(event\) => setInlineEditor\(\(current\) => \(current \? \{ \.\.\.current, answerText: event\.target\.value \} : current\)\)\}\s+className="min-h-\[100px\] border-none bg-transparent resize-none p-0 focus-visible:ring-0"\s+\/>/g;

const inlineAddNew = `{inlineEditor.questionType === 'checkbox' ? (
                                        <div className="space-y-2 mt-2 w-full pr-4 pb-4">
                                          {(inlineEditor.answerText || '').split(' | ').map((ans, i, arr) => (
                                            <div key={i} className="flex gap-2 items-center">
                                              <span className="text-muted-foreground/50 opacity-50"><GripVertical size={14} /></span>
                                              <Input
                                                type="text"
                                                value={ans}
                                                placeholder={\`Checkbox answer option \${i + 1}\`}
                                                className="h-8 text-sm flex w-full rounded-md border border-input bg-background/50 px-3 py-1 shadow-sm"
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
                                            className="h-8 mt-2 w-full border-dashed border-2 flex items-center justify-center gap-1 text-muted-foreground"
                                          >
                                            <Plus size={14} /> Add an option
                                          </Button>
                                        </div>
                                      ) : (
                                      <Textarea
                                        value={inlineEditor.answerText}
                                        onChange={(event) => setInlineEditor((current) => (current ? { ...current, answerText: event.target.value } : current))}
                                        className="min-h-[100px] border-none bg-transparent resize-none p-0 focus-visible:ring-0"
                                      />
                                      )}`;

let matchInline = inlineRegex.exec(c);
if (matchInline) {
    c = c.replace(matchInline[0], inlineAddNew);
    console.log("Patched Inline");
} else {
    console.log("Could not find Inline textarea via regex.");
}

fs.writeFileSync(filePath, c, 'utf-8');
