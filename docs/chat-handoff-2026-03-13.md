# Chat Handoff - 2026-03-13

## Current app links
- Web app local URL: `http://localhost:3000`
- Admin Sources: `http://localhost:3000/admin/sources`
- Admin Dashboard: `http://localhost:3000/admin/dashboard`
- Client Dashboard: `http://localhost:3000/dashboard`
- Login: `http://localhost:3000/login`

## Important local files
- Web app env: [apps/web/.env.local](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/.env.local)
- Web README: [README.md](/c:/Users/glenn/Documents/NEW%20PROJECT/README.md)
- Current admin Sources UI: [apps/web/src/features/admin/admin-source-manager.tsx](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/features/admin/admin-source-manager.tsx)
- Sources page entry: [apps/web/src/app/(admin)/admin/sources/page.tsx](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/app/(admin)/admin/sources/page.tsx)
- Admin data loader: [apps/web/src/features/admin/server.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/features/admin/server.ts)
- Subject Q&A query layer: [apps/web/src/lib/supabase/subject-qa.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/lib/supabase/subject-qa.ts)
- Admin Q&A APIs:
  - [apps/web/src/app/api/admin/subject-qa/route.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/app/api/admin/subject-qa/route.ts)
  - [apps/web/src/app/api/admin/subject-qa/[id]/route.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/app/api/admin/subject-qa/%5Bid%5D/route.ts)
- Retrieval path:
  - [apps/web/src/lib/ai/retrieval.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/lib/ai/retrieval.ts)
  - [apps/web/src/lib/ai/answering.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/lib/ai/answering.ts)
  - [apps/web/src/lib/ai/analyze.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/lib/ai/analyze.ts)
- Extension side panel:
  - [apps/extension/src/sidepanel/panel-app.tsx](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/src/sidepanel/panel-app.tsx)
  - [apps/extension/src/sidepanel/sidepanel.css](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/src/sidepanel/sidepanel.css)
- Extension extractor:
  - [apps/extension/src/content/extractor.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/src/content/extractor.ts)
- Extension service worker:
  - [apps/extension/src/background/service-worker.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/src/background/service-worker.ts)

## Extension package and install paths
- Latest downloadable ZIP in web app:
  - [apps/web/public/downloads/study-assistant-extension.zip](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/public/downloads/study-assistant-extension.zip)
- Download URL from portal:
  - `http://localhost:3000/downloads/study-assistant-extension.zip`
- Built unpacked extension folder:
  - `C:\Users\glenn\Documents\NEW PROJECT\apps\extension\dist`
- Chrome install flow:
  1. Open `chrome://extensions`
  2. Turn on `Developer mode`
  3. `Load unpacked`
  4. Select `C:\Users\glenn\Documents\NEW PROJECT\apps\extension\dist`

## Current account credentials
- Admin:
  - email: `admin@example.com`
  - password: `StudyAssistAdmin2026!`
- Client:
  - email: `client.one@example.com`
  - password: `StudyAssistClient2026!`
- Extra client:
  - email: `client123@example.com`
  - password: `client123`
- `client123@example.com` was given a very large test wallet balance for extension testing.

## Current Sources tab behavior
- Sources UI is now subject-only on the left.
- Category clutter like prelim/midterm/finals was removed from the Sources page UI.
- The current subject folder is shown clearly in the main panel.
- Q&A editor is now:
  - Question on the left
  - Answer on the right
- Supported actions in the Sources UI:
  - Add Q&A pair
  - Edit Q&A pair
  - Activate/deactivate Q&A pair
  - Delete Q&A pair
  - Create subject folder if missing
  - Upload optional source files into the selected subject folder
- Important logic rule:
  - Q&A editing is disabled until the subject root folder exists
  - The extension checks subject Q&A pairs first before file-based chunk retrieval

## Subjects/data already added
- `Early Childhood Care and Education`
- `Calculus-Based Physics 2`
  - course code: `NSCI-6101`
  - imported from workbook:
    - `C:\Users\glenn\Pictures\calculus based physics 2 correct answers.xlsx`
  - imported Q&A pairs: `258`

## Database / migration notes
- Subject Q&A migration file:
  - [supabase/migrations/0008_subject_qa_pairs.sql](/c:/Users/glenn/Documents/NEW%20PROJECT/supabase/migrations/0008_subject_qa_pairs.sql)
- Import scripts:
  - [apps/web/scripts/import-subject-qa-json.mjs](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/scripts/import-subject-qa-json.mjs)
  - [apps/web/scripts/generated/calculus-based-physics-2.answers.json](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/scripts/generated/calculus-based-physics-2.answers.json)

## AI provider status
- The app was rewired to support NVIDIA-compatible OpenAI API mode on the backend.
- Important file:
  - [apps/web/src/lib/ai/openai.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/lib/ai/openai.ts)
- If the extension shows `AI service is currently unavailable`, it means the backend provider call failed and fallback mode was used.
- Secrets pasted in chat earlier should be rotated later.

## Extension behavior constraints
- No auto-clicking
- No auto-submit
- No cheating automation on graded pages
- The extension is suggestion-only:
  - analyze current tab after user action
  - detect subject/context
  - suggest answer/explanation/confidence

## Verified status before this handoff
- `pnpm.cmd --filter @study-assistant/web typecheck` passed
- `pnpm.cmd --filter @study-assistant/web build` passed
- `pnpm.cmd --filter @study-assistant/extension typecheck` passed in earlier passes
- `pnpm.cmd --filter @study-assistant/extension build` passed in earlier passes
- One important runtime note:
  - `next dev` has been unstable in this Windows environment
  - `next start` from a fresh build was the more stable local run mode

## Current local runtime note
- The app was last brought up using the built app path.
- If `localhost:3000` stops responding again, preferred restart flow:
  1. `pnpm.cmd --filter @study-assistant/web build`
  2. `cd apps/web`
  3. `pnpm.cmd start`

## Next task requested by user
- Next target source/reference:
  - `https://www.answerscrib.com/subject/sosyi-literatura-panitikan-panlipunan`
- Planned next work in the new chat:
  1. Inspect that source/reference safely
  2. Decide what subject/folder it should map to
  3. Convert it into subject-level Q&A storage inside Admin Sources
  4. Improve extension subject detection and retrieval so it can use that subject library cleanly
  5. Keep the extension UI minimal: detect/analyze current tab, live assist, and answer suggestion only

## Short prompt to resume in next chat
- "Continue from `docs/chat-handoff-2026-03-13.md`. The next task is to inspect `https://www.answerscrib.com/subject/sosyi-literatura-panitikan-panlipunan`, map it to a subject source library, and continue improving the subject-linked extension retrieval flow."
