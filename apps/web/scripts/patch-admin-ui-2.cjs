// Patch admin-source-manager.tsx - Part 2: Add UI elements for question type
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

// 1. Add question type selector before the Question/Answer grid in the Quick Add form
replace('add type selector to quick add form',
  `<CardContent className="space-y-6">\r\n                      <div className="grid gap-6 xl:grid-cols-2">\r\n                        <div className="space-y-3">\r\n                          <label className="text-sm font-semibold text-foreground flex items-center gap-2">\r\n                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-accent-foreground font-bold">1</span> Question Formulation`,
  `<CardContent className="space-y-6">\r
                      {/* ── Question Type Selector ── */}\r
                      <div className="space-y-2">\r
                        <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Question Type</label>\r
                        <div className="flex flex-wrap gap-2">\r
                          {QUESTION_TYPE_OPTIONS.map((opt) => (\r
                            <button\r
                              key={opt.value}\r
                              type="button"\r
                              className={\`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all \${editor.questionType === opt.value ? 'bg-accent text-accent-foreground border-accent shadow-md' : 'bg-background/50 text-muted-foreground border-border/50 hover:bg-background/80 hover:border-border'}\`}\r
                              onClick={() => setEditor((current) => ({ ...current, questionType: opt.value }))}\r
                              disabled={!selectedRootFolder}\r
                            >\r
                              <span>{opt.icon}</span>\r
                              <span>{opt.label}</span>\r
                            </button>\r
                          ))}\r
                        </div>\r
                        {editor.questionType === 'checkbox' && (\r
                          <p className="text-xs text-muted-foreground mt-1">💡 For checkbox answers, separate each correct answer with a pipe <code className="bg-muted px-1 rounded">|</code> character. Example: <code className="bg-muted px-1 rounded">Choice A | Choice B | Choice C</code></p>\r
                        )}\r
                        {editor.questionType === 'fill_in_blank' && (\r
                          <p className="text-xs text-muted-foreground mt-1">💡 The answer will be typed directly into the text input field on the quiz page.</p>\r
                        )}\r
                        {editor.questionType === 'dropdown' && (\r
                          <p className="text-xs text-muted-foreground mt-1">💡 The answer will be selected from a dropdown menu. Enter the exact text of the correct option.</p>\r
                        )}\r
                      </div>\r
\r
                      <div className="grid gap-6 xl:grid-cols-2">\r
                        <div className="space-y-3">\r
                          <label className="text-sm font-semibold text-foreground flex items-center gap-2">\r
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-accent-foreground font-bold">1</span> Question Formulation`
);

// 2. Add question type badge to the QA pair card display (read-only view)
replace('add type badge to pair card',
  `<div className="flex items-center gap-2">\r\n                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">Q</div>\r\n                                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Question</p>\r\n                                      </div>`,
  `<div className="flex items-center gap-2">\r
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">Q</div>\r
                                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Question</p>\r
                                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{getQuestionTypeBadge(pair.question_type ?? 'multiple_choice')}</span>\r
                                      </div>`
);

// 3. Add question type selector to inline editor (edit mode)
replace('add type selector to inline editor',
  `<label className="flex items-center gap-3 rounded-[20px] border border-border/30 bg-background/40 px-4 py-3 text-sm text-foreground cursor-pointer transition-colors hover:bg-background/60">\r\n                                    <input type="checkbox" className="h-4 w-4 accent-accent rounded" checked={inlineEditor.isActive}`,
  `{/* Inline question type selector */}\r
                                  <div className="space-y-2">\r
                                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Question Type</label>\r
                                    <div className="flex flex-wrap gap-1.5">\r
                                      {QUESTION_TYPE_OPTIONS.map((opt) => (\r
                                        <button\r
                                          key={opt.value}\r
                                          type="button"\r
                                          className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all \${inlineEditor.questionType === opt.value ? 'bg-accent text-accent-foreground border-accent' : 'bg-background/50 text-muted-foreground border-border/30 hover:bg-background/60'}\`}\r
                                          onClick={() => setInlineEditor((current) => current ? { ...current, questionType: opt.value } : current)}\r
                                        >\r
                                          <span>{opt.icon}</span>\r
                                          <span>{opt.label}</span>\r
                                        </button>\r
                                      ))}\r
                                    </div>\r
                                  </div>\r
\r
                                  <label className="flex items-center gap-3 rounded-[20px] border border-border/30 bg-background/40 px-4 py-3 text-sm text-foreground cursor-pointer transition-colors hover:bg-background/60">\r
                                    <input type="checkbox" className="h-4 w-4 accent-accent rounded" checked={inlineEditor.isActive}`
);

fs.writeFileSync(filePath, c, 'utf-8');
console.log(`\nPatched admin-source-manager.tsx with ${changeCount} UI changes`);
