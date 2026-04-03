# AI Agent Complete Handoff

> **IMPORTANT: ONLINE DEPLOYMENT (VERCEL + GITHUB)**
> The user NO LONGER uses `localhost`. The application is deployed online via Vercel (`study-assistant-web.vercel.app`) connected to the GitHub repository (`https://github.com/frankglen62-cmyk/study-assistant.git`). 
> Every time you make changes to the Web App or the Extension, you MUST commit and push them to GitHub so Vercel can automatically build and deploy them. Do not rely on localhost or local scripts unless explicitly building locally to test.

This file is the full handoff and memory backup for the project in:

- `C:\Users\glenn\Documents\NEW PROJECT`

Use this document when a new AI agent needs to understand how the app works, where the code lives, how to run it, how to debug stale changes, and what parts are important.

## 1. Project Summary

Project name:

- `Admin-Managed AI Study Assistant`

The app is a monorepo SaaS product with:

- a public website
- an auth flow
- a client portal
- an admin portal
- a Chrome extension
- a Supabase database
- a private subject/source library
- a session and wallet billing system
- AI-powered subject detection and source-based answer suggestion

The product boundary is suggestion-only:

- no auto-clicking
- no auto-submit
- no silent all-tab scraping
- no raw private source leakage to clients

## 2. Main Tech Stack

### Frontend

- `Next.js 15` App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS`
- `next-themes`
- shared UI/components from local workspace packages

Main frontend app:

- `apps/web`

Chrome extension frontend:

- `apps/extension`

### Backend

There is no separate Express/Nest backend.

The backend lives inside the Next.js app through:

- route handlers under `apps/web/src/app/api/*`
- server-side service modules under `apps/web/src/lib/*`
- server-side feature loaders under `apps/web/src/features/*`

### Database and persistence

- `Supabase Postgres`
- `Supabase Auth`
- `Supabase Storage`
- `pgvector`

Database migrations live in:

- `supabase/migrations`

Current migration files:

- `0001_core_schema.sql`
- `0002_rls_policies.sql`
- `0003_functions_and_triggers.sql`
- `0004_storage_and_vector_indexes.sql`
- `0005_runtime_workflows.sql`
- `0006_client_settings_and_payment_credit.sql`
- `0007_wallet_function_return_fix.sql`
- `0008_subject_qa_pairs.sql`

## 3. Repo Structure

Top-level important folders:

- `apps/web`
- `apps/extension`
- `packages/shared-types`
- `packages/shared-utils`
- `packages/ui`
- `supabase/migrations`
- `supabase/seed`
- `docs`
- `scripts`

### `apps/web`

This is the main web app.

Important folders:

- `apps/web/src/app`
- `apps/web/src/components`
- `apps/web/src/features`
- `apps/web/src/lib`

### `apps/extension`

This is the Chrome extension.

Important folders:

- `apps/extension/src/background`
- `apps/extension/src/content`
- `apps/extension/src/onboarding`
- `apps/extension/src/sidepanel`
- `apps/extension/src/lib`
- `apps/extension/public/manifest.json`

### Shared workspace packages

- `packages/shared-types`: shared DTOs, API contracts, domain types
- `packages/shared-utils`: shared helpers/constants
- `packages/ui`: reusable UI primitives

## 4. Web App Portals and Route Groups

The web app uses App Router route groups.

### Public pages

Location:

- `apps/web/src/app/(public)`

Examples:

- `/`
- `/features`
- `/pricing`
- `/contact`
- `/privacy`
- `/terms`
- `/practice/ecce-sample`

### Auth pages

Location:

- `apps/web/src/app/(auth)`

Examples:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`

### Client portal

Location:

- `apps/web/src/app/(client)`

Main pages:

- `/dashboard`
- `/sessions`
- `/buy-credits`
- `/usage-logs`
- `/settings`
- `/account`
- `/extension-guide`

### Admin portal

Location:

- `apps/web/src/app/(admin)/admin`

Main pages:

- `/admin`
- `/admin/dashboard`
- `/admin/sources`
- `/admin/subjects`
- `/admin/categories`
- `/admin/users`
- `/admin/payments`
- `/admin/sessions`
- `/admin/sessions/[id]`
- `/admin/users/[id]/sessions`
- `/admin/reports`
- `/admin/audit-logs`
- `/admin/settings`

## 5. What Each Major Portal Does

### Public site

Purpose:

- marketing
- feature explanation
- pricing display
- contact and trust pages

### Client portal

Purpose:

- manage wallet and credits
- start, pause, resume, end sessions
- generate extension pairing code
- view extension guide
- manage paired devices
- revoke devices
- buy credits
- check usage

### Admin portal

Purpose:

- manage subject libraries
- manage subject Q&A storage
- optionally manage file-based sources
- manage users
- manage wallet adjustments
- review payments
- audit sessions
- inspect reports
- review audit logs

### Extension

Purpose:

- pair with a client account
- read the current page only after user action or enabled live assist
- detect subject/context
- send page signals to backend
- show suggestion-only answers
- show source match metadata
- show detected subject/category

## 6. Database Tables and What They Are For

Created from migrations:

- `public.profiles`
  - user profile metadata, role, account status, display name, timezone
- `public.wallets`
  - remaining credits in seconds
- `public.payment_packages`
  - top-up packages
- `public.payment_customers`
  - provider customer mapping
- `public.payments`
  - payment records
- `public.subjects`
  - academic subject folders
- `public.folders`
  - private folder hierarchy for source grouping
- `public.categories`
  - optional sub-contexts such as quiz/practice/reviewer
- `public.source_files`
  - uploaded file sources
- `public.source_versions`
  - file version history
- `public.source_processing_jobs`
  - ingestion/reprocess status
- `public.source_chunks`
  - processed text chunks with embeddings
- `public.subject_qa_pairs`
  - canonical subject-level Q&A pairs used first during retrieval
- `public.extension_installations`
  - paired browser/device records
- `public.extension_tokens`
  - hashed refresh tokens for extension auth
- `public.extension_pairing_codes`
  - short-lived extension pairing codes
- `public.sessions`
  - billed usage windows
- `public.question_attempts`
  - analyze attempts and telemetry
- `public.credit_transactions`
  - wallet ledger
- `public.audit_logs`
  - admin/security mutation log
- `public.notifications`
  - internal/user notification records
- `public.support_tickets`
  - support issue records
- `public.system_settings`
  - system-wide config
- `public.client_settings`
  - client preferences

## 7. Core App Flows

### A. Subject/source flow

Current intended logic:

1. Admin creates a subject folder in `Admin > Sources`.
2. Admin stores Q&A pairs inside that subject folder.
3. Optional file sources can also exist for that subject.
4. When the extension analyzes a page:
   - detect the subject first
   - search that subject folder first
   - use stored Q&A pairs first
   - then use supporting file sources/chunks
   - if enabled, fallback to all subject folders to find similar matches

Main code:

- `apps/web/src/lib/ai/retrieval.ts`
- `apps/web/src/lib/ai/analyze.ts`
- `apps/web/src/lib/ai/answering.ts`
- `apps/web/src/lib/supabase/subject-qa.ts`
- `apps/web/src/features/admin/admin-source-manager.tsx`

### B. Extension pairing flow

1. Client logs into portal.
2. Client generates pairing code.
3. Extension onboarding takes:
   - app URL
   - device name
   - pairing code
4. Backend exchanges code for installation token set.
5. Extension stores the installation/token state locally.
6. Extension refreshes tokens using backend routes.
7. Admin/client can revoke device later.

Routes:

- `POST /api/auth/extension/pair`
- `POST /api/auth/extension/exchange`
- `POST /api/auth/extension/refresh`

Important code:

- `apps/web/src/app/api/auth/extension/pair/route.ts`
- `apps/web/src/app/api/auth/extension/exchange/route.ts`
- `apps/web/src/app/api/auth/extension/refresh/route.ts`
- `apps/web/src/lib/supabase/extension.ts`
- `apps/extension/src/onboarding`
- `apps/extension/src/lib/api.ts`

### C. Session flow

Purpose of a session:

- it is the billed usage window of extension/client activity
- it measures usage duration
- it tracks subject/site usage context
- it supports wallet debits
- it helps audit, reporting, and admin review

What a session should represent:

- one continuous usage window
- with `start`, `pause`, `resume`, `end`
- with `credits used`
- with `site/domain`
- with `subject/category`
- with `analyze attempts`

Routes:

- `POST /api/client/sessions/start`
- `POST /api/client/sessions/pause`
- `POST /api/client/sessions/resume`
- `POST /api/client/sessions/end`

Important code:

- `apps/web/src/lib/sessions/service.ts`
- `apps/web/src/lib/supabase/sessions.ts`
- `apps/web/src/app/api/client/sessions/*`
- client UI:
  - `apps/web/src/app/(client)/sessions/page.tsx`
  - `apps/web/src/features/client/session-manager.tsx`

### D. Analyze flow

1. Extension extracts page signals from the active tab.
2. Backend validates:
   - session state
   - wallet/credits
   - extension auth
3. Backend detects subject/category.
4. Backend extracts the question and choices.
5. Backend searches subject sources.
6. Backend returns suggestion-only response:
   - answer text
   - suggested visible choice
   - explanation
   - subject/category
   - confidence
   - fallback info

Route:

- `POST /api/client/analyze`

Important code:

- `apps/web/src/app/api/client/analyze/route.ts`
- `apps/web/src/lib/ai/analyze.ts`
- `apps/web/src/lib/ai/detection.ts`
- `apps/web/src/lib/ai/extraction.ts`
- `apps/web/src/lib/ai/retrieval.ts`
- `apps/web/src/lib/ai/answering.ts`
- `apps/web/src/lib/ai/choice-matching.ts`
- extension side:
  - `apps/extension/src/content/extractor.ts`
  - `apps/extension/src/background/service-worker.ts`
  - `apps/extension/src/sidepanel/panel-app.tsx`

### E. Wallet and billing flow

Billing model:

- credits are stored as seconds
- session/analyze usage consumes wallet seconds
- payments top up credits
- admin can manually add/deduct credits

Routes:

- `GET /api/client/wallet`
- `POST /api/client/payments/create-checkout`
- `GET /api/client/payments/history`
- webhooks:
  - `/api/webhooks/stripe`
  - `/api/webhooks/paymongo`

Important code:

- `apps/web/src/lib/billing/wallet.ts`
- `apps/web/src/lib/payments/service.ts`
- `apps/web/src/lib/payments/paymongo.ts`
- `apps/web/src/app/(client)/buy-credits/page.tsx`

## 8. API Areas Used by the App

### Auth and extension

- `/api/auth/extension/pair`
- `/api/auth/extension/exchange`
- `/api/auth/extension/refresh`

### Client

- `/api/client/wallet`
- `/api/client/sessions/start`
- `/api/client/sessions/pause`
- `/api/client/sessions/resume`
- `/api/client/sessions/end`
- `/api/client/analyze`
- `/api/client/settings`
- `/api/client/devices`
- `/api/client/devices/revoke`
- `/api/client/payments/create-checkout`
- `/api/client/payments/history`

### Public

- `/api/public/payment-packages`

### Admin

- `/api/admin/users`
- `/api/admin/users/[id]/credits`
- `/api/admin/users/[id]/status`
- `/api/admin/subjects`
- `/api/admin/subjects/[id]`
- `/api/admin/categories`
- `/api/admin/categories/[id]`
- `/api/admin/folders`
- `/api/admin/folders/[id]`
- `/api/admin/sources/upload`
- `/api/admin/sources/[id]`
- `/api/admin/sources/[id]/reprocess`
- `/api/admin/subject-qa`
- `/api/admin/subject-qa/[id]`
- `/api/admin/subject-qa/counts`
- `/api/admin/payments`
- `/api/admin/sessions`
- `/api/admin/reports`
- `/api/admin/reports/summary`
- `/api/admin/audit-logs`

## 9. Important Code Locations by Concern

### Public/client/admin pages

All live here:

- `apps/web/src/app`

### Shared feature loaders and UI logic

- `apps/web/src/features/admin`
- `apps/web/src/features/client`

### AI backend logic

- `apps/web/src/lib/ai`

### Supabase and data access

- `apps/web/src/lib/supabase`

### Security/auth helpers

- `apps/web/src/lib/auth`
- `apps/web/src/lib/security`
- `apps/web/src/lib/http`

### Sessions and billing

- `apps/web/src/lib/sessions`
- `apps/web/src/lib/billing`
- `apps/web/src/lib/payments`

### Environment validation

- `apps/web/src/lib/env`

### Extension orchestration

- `apps/extension/src/background`
- `apps/extension/src/content`
- `apps/extension/src/sidepanel`
- `apps/extension/src/onboarding`
- `apps/extension/src/lib`

## 10. Sources Tab Design and Behavior

Current intended behavior:

- left side = subject folders only
- each subject folder contains:
  - Q&A pairs
  - optional files
- subject Q&A should load dynamically per selected subject
- Q&A actions:
  - add
  - edit
  - activate/deactivate
  - delete
- subject actions:
  - add subject
  - rename subject
  - delete subject
- deletion should remove the subject library and disappear from list

Important files:

- `apps/web/src/app/(admin)/admin/sources/page.tsx`
- `apps/web/src/features/admin/admin-source-manager.tsx`
- `apps/web/src/features/admin/server.ts`
- `apps/web/src/lib/admin/service.ts`
- `apps/web/src/lib/supabase/subject-qa.ts`

Known sensitivity:

- if the page seems to show `0` rows for a subject that should have data, it may be a stale server/build/UI cache issue
- newer fixes moved toward dynamic per-subject loading rather than loading all Q&A in the first render

## 11. Current Imported Subject Libraries

These were added during the project work and are important context:

- `UGRD-NSCI6101 / Calculus-Based Physics 2`
- `UGRD-FILI6301 / Pagsasaling Pampanitikan`
- `UGRD-ITE6202 / Professional Ethics in IT / Social & Professional I`
- `UGRD-CS6209 / Software Engineering 1`
- `UGRD-IT6206 / Information Assurance and Security 2`
- `UGRD-ITE6220 / Information Management`
- `UGRD-IT6399 / IT Capstone Project`
- `UGRD-IT6302 / Integrative Programming and Technology 1`

Local import helper scripts live in:

- `apps/web/scripts`

Generated import JSON files live in:

- `apps/web/scripts/generated`

## 12. Extension Build, ZIP, and Versioning

Current extension package version:

- `0.1.1`

Important files:

- `apps/extension/package.json`
- `apps/extension/public/manifest.json`
- `apps/web/src/lib/extension-distribution.ts`

Latest portal ZIP path:

- `apps/web/public/downloads/study-assistant-extension.zip`

Client download URL:

- `http://localhost:3000/downloads/study-assistant-extension.zip`

Expected extension install flow:

1. download ZIP from client portal
2. extract ZIP to a new folder
3. open `chrome://extensions`
4. remove or reload old unpacked extension
5. load unpacked from the new extracted folder

Important operational note:

- if the extension code changes, the client must reload or reinstall the unpacked extension
- if the portal says the extension is still old, make sure:
  - portal web app was rebuilt/restarted
  - extension was rebuilt
  - ZIP was refreshed
  - unpacked extension was reloaded from the fresh extracted folder

## 13. How to Start the Web App

### Preferred normal way

Double-click:

- `C:\Users\glenn\Documents\NEW PROJECT\scripts\open-web.cmd`

This should:

- start the server in a command window
- open the browser to login

### Direct script way

Use:

- `C:\Users\glenn\Documents\NEW PROJECT\scripts\start-web.cmd`

### Stop script

Use:

- `C:\Users\glenn\Documents\NEW PROJECT\scripts\stop-web.cmd`

### Manual terminal way

From:

- `C:\Users\glenn\Documents\NEW PROJECT\apps\web`

Run:

```powershell
pnpm.cmd build
pnpm.cmd start
```

### Root scripts

From repo root:

```powershell
pnpm dev:web
pnpm typecheck
pnpm test
```

## 14. If an AI Agent Changes Code But the User Sees No Change

This is one of the most important operational problems in this project.

The future AI agent should assume that a missing visible change is often caused by one of these:

- stale `next start` process
- stale `.next` build output
- browser cache
- old unpacked extension still loaded
- portal ZIP not refreshed after extension rebuild
- stale dynamic data in admin/client page

### Required recovery checklist for web app changes

If the AI agent changes web code and the user says “wala naman nabago”:

1. Run web build again:

```powershell
cd c:\Users\glenn\Documents\NEW PROJECT\apps\web
pnpm.cmd build
```

2. Restart the web server:

```powershell
pnpm.cmd start
```

or use:

- `scripts/start-web.cmd`

3. Tell the user to:
   - close old `localhost:3000` tabs
   - reopen the page
   - hard refresh with `Ctrl + Shift + R`

4. If the user is testing on their **ONLINE URL (Vercel)**, the local build DOES NOT MATTER!
   - You MUST push the code to the GitHub repo using `git push`.
   - Vercel automatically builds exactly what is in the GitHub repo.
   - You MUST instruct the user to check their Vercel Deployment Dashboard to ensure the commit has finished building and is marked as "Ready".
   - If the Vercel commit is not building or failed, the user will STILL see the old logic even if your local code is perfect! NEVER claim an issue is "fixed" until you have explicitly pushed the changes to the GitHub repo and verified the Vercel build status.

5. If the issue is still visible:
   - verify the built file actually contains the new code
   - verify the route is hitting the new build
   - check if a stale process is still running on port `3000`

### Required recovery checklist for extension changes

If the AI agent changes extension code and the user says “wala namang nabago”:

1. Rebuild the extension:

```powershell
cd c:\Users\glenn\Documents\NEW PROJECT
pnpm.cmd --filter @study-assistant/extension build
```

2. Refresh the ZIP in:

- `apps/web/public/downloads/study-assistant-extension.zip`

3. Tell the user to:
   - download the ZIP again
   - extract to a new folder
   - remove or reload the old unpacked extension
   - `Load unpacked` again

4. If version UI is involved:
   - verify `manifest.json` version
   - verify portal version display code
   - verify web app has been rebuilt/restarted too

### Required recovery checklist for dynamic data issues

If the AI agent changes Sources, Subjects, Q&A, counts, or admin data and the UI still looks wrong:

1. Verify data in Supabase actually exists.
2. Verify the API route returns the expected rows.
3. Add or use a reload button if necessary.
4. Avoid relying on stale initial render data.
5. Rebuild/restart web app if page behavior still looks old.

## 15. Important Runtime Problems Seen in This Project

The next AI agent should know these recurring issues:

### A. `ERR_CONNECTION_REFUSED`

Meaning:

- no running local server on port `3000`

Fix:

- start the app again with `scripts/open-web.cmd` or `scripts/start-web.cmd`

### B. Old UI still visible after code change

Meaning:

- stale build/server/browser cache

Fix:

- rebuild
- restart
- hard refresh

### C. Extension looks unchanged

Meaning:

- old unpacked extension still loaded

Fix:

- rebuild extension
- download fresh ZIP
- extract to new folder
- remove/reload old extension

### D. Unstyled black page / CSS missing

Meaning:

- stale server or mismatched build asset references

Fix:

- rebuild web app
- restart web app
- close old tabs

## 16. Current Environment and Scripts

Root package:

- `package.json`

Important root scripts:

- `pnpm dev:web`
- `pnpm typecheck`
- `pnpm test`
- `pnpm format`

Web package:

- `apps/web/package.json`

Important web scripts:

- `pnpm.cmd dev`
- `pnpm.cmd build`
- `pnpm.cmd start`
- `pnpm.cmd typecheck`
- `pnpm.cmd seed:ecce-demo`
- `pnpm.cmd seed:physics-quiz-demo`

Extension package:

- `apps/extension/package.json`

Important extension scripts:

- `pnpm.cmd --filter @study-assistant/extension build`
- `pnpm.cmd --filter @study-assistant/extension typecheck`

## 17. Environment Variables

Main file:

- `apps/web/.env.local`

Template:

- `apps/web/.env.example`

Important vars:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_API_COMPAT_MODE`
- `OPENAI_SUPPORTS_IMAGE_INPUT`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYMONGO_SECRET_KEY`
- `PAYMONGO_WEBHOOK_SECRET`
- `PAYMONGO_API_BASE_URL`
- `EXTENSION_PAIRING_SECRET`
- `SESSION_IDLE_SECONDS`
- `LOW_CREDIT_THRESHOLD_SECONDS`
- `MAX_UPLOAD_SIZE_MB`
- `OPENAI_EXTRACTION_MODEL`
- `OPENAI_ANSWER_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_SUBJECT_MODEL`

## 18. Sample Accounts Known in the Project

Seeded/demo accounts found in repo/docs:

- `superadmin@example.com`
- `admin@example.com`
- `client.one@example.com`
- `client.two@example.com`

Additional local testing account used during work:

- `client123@example.com`

Note:

- these are local/dev/testing context only
- passwords were used during earlier setup, but the next AI agent should confirm current auth state before relying on them

## 19. What the Next AI Agent Should Prioritize

When continuing work on this project, the next AI agent should:

1. Check if the user issue is:
   - stale build
   - stale extension
   - missing data
   - wrong subject detection
   - wrong source matching
2. Verify the actual backend/API behavior before claiming a fix.
3. Rebuild and restart the web app whenever major UI/server changes were made.
4. Rebuild and refresh the extension ZIP whenever extension code changes were made.
5. For Sources issues:
   - confirm data in Supabase
   - confirm admin APIs return it
   - then confirm UI loads it
6. For extension answer issues:
   - confirm detected subject
   - confirm source subject used
   - confirm Q&A exists in `subject_qa_pairs`
   - confirm visible choice mapping is correct

## 20. CRITICAL: Moodle / AmaOEd Structure (Attempt Review vs. Live Exam)

A major bug was resolved where "Duplicate Questions" with different choices were incorrectly disambiguated. Future AI MUST understand the DOM structure of AmaOEd/Moodle and the difference between "Attempt Review" and "Live Quizzes".

**The Moodle DOM Architecture:**
1. Every question box is wrapped in a main container: `<div class="que">`.
2. Inside `.que` is `<div class="content">`, which holds `<div class="formulation">`.
3. Inside `.formulation`, the actual question prompt is inside `<div class="qtext">`.
4. The choices (A, B, C, D) are separated into a sibling `<div class="ablock">` containing `<div class="answer">`.

**The Differences & Extraction Issues:**
- **Attempt Review Pages:** Radio buttons have `disabled="disabled"`. Sometimes extracting `.qtext` separately from `ablock` caused the localized `candidate.options` to return empty `[]`.
- **Live Quizzes:** Moodle assigns inputs with colons in the IDs, e.g. `q94106:20_answer0`. Passing this to `document.querySelector('label[for="q94106:20_answer0"]')` will throw a `SyntaxError: Invalid Selector` DOMException because colons signify pseudo-classes in CSS.
- **Missing Labels:** In live quizzes, Moodle often drops the `<label>` tag entirely and replaces it with a structurally detached `<div aria-labelledby="id">` or sibling `div` elements.

**The Crash Impact:**
- When `extractOptions` fails due to the DOMException or missing labels, `candidate.options` resolves to an EMPTY ARRAY `[]`.
- If `candidate.options` is empty, the Vercel backend (`hasChoices = false`) cannot use Choice-Aware Disambiguation and drops all Choice Scores to `0.0`.
- The backend defaults to ranking answers by their Database `updated_at` (Newest wins), ignoring actual on-screen choices and providing incorrect answers.

**The Solution Implemented:**
- `extractor.ts` now uses `CSS.escape(id)` to prevent DOM crashes when extracting `label[for=""]`.
- The extractor explicitly uses `input.getAttribute('aria-labelledby')` and immediate parent fallbacks to parse text successfully without needing `<label>` wrapper tags.
- `cleanOptionLabel()` strictly strips `"a. "`, `"b. "`, `"1. "` prefixes to guarantee that extracted on-screen options are EXACT string matches with the normalized options saved in the database, allowing for a pure 1.0 Choice Match ranking.
- **LESSON:** Future agents MUST preserve `CSS.escape()` and `aria-labelledby` extractions. If `TP-Heavy` misses its context again, check if `cleanOptionLabel` actually stripped out unwanted HTML elements or artifacts like "Correct/Incorrect" and letter prefixes.

## 21. CRITICAL: Vercel Deployment & Code Verification Rules

Future AI agents: You must understand the difference between fixing something *locally* and fixing it *for the user's online Vercel environment*.

1. **Local vs Online:** The user often tests changes directly on their public Vercel URL. Restarting the Next.js `dev` server or running `pnpm build` locally does absolutely nothing to the Vercel deployment.
2. **Push is Mandatory:** All code changes and fixes MUST be committed and pushed to the GitHub repository (`git push`).
3. **Vercel Dashboard:** Inform the user to check their Vercel Deployments log. Even if you pushed the code, Vercel takes 1-2 minutes to build. If they test the site while it's still building, they will see the OLD bug and tell you "it still doesn't work".
4. **Agent Integrity:** Do not make false assurances. Do not say "I have fixed it on your live site" unless you literally committed the code, pushed it to GitHub, and the Vercel build succeeded.

## 22. Quick Resume Prompt for Another AI Agent

If another AI agent needs to continue, use this:

`Continue from docs/ai-agent-complete-handoff.md. Check current web runtime, extension version, subject sources, and ensure all changes have been pushed to GitHub to trigger Vercel deployment. Review Section 20 and 21 before continuing.`
