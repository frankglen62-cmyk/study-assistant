# Admin-Managed AI Study Assistant

Production monorepo for a study platform with:

- public website
- client portal
- admin portal
- Chrome side panel extension
- paired browser/device workflow
- admin-managed subject and Q&A library
- session-based usage tracking and billing
- server-side subject detection and answer retrieval

## Current Live State

- Production web app: `https://study-assistant-web.vercel.app`
- GitHub repo: `https://github.com/frankglen62-cmyk/study-assistant.git`
- Active branch for production: `main`
- Vercel project: `study-assistant-web`
- Current extension release: `v0.1.44`

## Current Shipped Features

### Web app

- public marketing pages, auth, client portal, and admin portal
- client dashboard with extension download/status card
- simplified Extension Guide with highlighted pairing mode and latest ZIP release info
- account page cleaned up to focus on account and extension status actions
- admin Sources area with subject folders, stored Q&A library, add/edit/delete/toggle flows, and subject/category management
- Stripe checkout flow and payment history pages

### Extension

- sidepanel-first pairing flow
- request portal permission, paste pairing code, pair directly in the sidepanel
- manual `Unpair Browser` action
- session controls with start, pause, resume, end, and countdown display
- split sidepanel workflow:
  - `Controls` workspace for setup, session, subject mode, activity log
  - `Answering` workspace for `Find All Answers`, Study Results, quick actions
- subject picker with live suggestions and manual subject lock
- auto detect fallback when no manual subject is locked
- `New Exam`, `Full Auto`, and `Select All`
- Study Results cards with confidence and click status

### Retrieval and matching improvements already shipped

- blank-aware matching for fill-in-the-blank questions
- better repeated-question disambiguation
- option filtering that ignores LMS control text such as `Clear my choice`
- LMS header and course-code aware subject detection
- fresher subject/Q&A cache behavior so admin changes appear faster

## Workspace

- `apps/web` - Next.js web app for public, client, admin, and API routes
- `apps/extension` - Chrome extension (Manifest V3)
- `packages/shared-types` - shared domain types
- `packages/shared-utils` - shared helpers and constants
- `packages/ui` - shared UI primitives
- `supabase/migrations` - schema, RLS, functions, storage, and runtime SQL

## Important Product Behavior

- the extension uses explicit user actions and portal pairing
- the portal controls subject and source data
- unpacked extension updates are distributed through the web app ZIP downloads
- extension changes are not visible online until the ZIP is rebuilt, committed, pushed, and deployed

## Local Setup

1. Install Node.js 20+ and `pnpm`.
2. Install dependencies with `pnpm install`.
3. Copy `apps/web/.env.example` to `apps/web/.env.local`.
4. Apply the Supabase migrations in `supabase/migrations`.
5. Start the web app with `pnpm dev:web`.
6. Build the extension with `pnpm --filter @study-assistant/extension build`.

## Common Commands

- `pnpm dev:web`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @study-assistant/web build`
- `pnpm --filter @study-assistant/extension build`
- `pnpm --filter @study-assistant/extension typecheck`

## Extension Loading

1. Build the extension workspace.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Load `apps/extension/dist` as an unpacked extension.
5. Open the side panel.
6. Request portal permission.
7. Paste the pairing code from the client portal.
8. Pair the browser.

## Production Workflow

If a change should appear online:

1. Edit code locally.
2. Run the relevant checks.
3. Rebuild the extension if extension code changed.
4. Refresh the ZIP in `apps/web/public/downloads`.
5. Commit to `main`.
6. Push to GitHub.
7. Wait for the Vercel deployment to finish.
8. Hard refresh the portal.
9. Re-download and reload the unpacked extension if the extension changed.

## Extension Distribution Files

- [apps/extension/public/manifest.json](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/public/manifest.json)
- [apps/extension/package.json](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/package.json)
- [apps/web/src/lib/extension-distribution.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/lib/extension-distribution.ts)
- [apps/web/public/downloads/study-assistant-extension.zip](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/public/downloads/study-assistant-extension.zip)

## Root Docs

- [DEPLOYMENT_DOCS.md](/c:/Users/glenn/Documents/NEW%20PROJECT/DEPLOYMENT_DOCS.md)
- [LAUNCH_CHECKLIST.md](/c:/Users/glenn/Documents/NEW%20PROJECT/LAUNCH_CHECKLIST.md)
- [QA_CHECKLIST.md](/c:/Users/glenn/Documents/NEW%20PROJECT/QA_CHECKLIST.md)
- [SECURITY_CHECKLIST.md](/c:/Users/glenn/Documents/NEW%20PROJECT/SECURITY_CHECKLIST.md)
- [PROJECT_MASTER_HANDOFF_PRIVATE.md](/c:/Users/glenn/Documents/NEW%20PROJECT/PROJECT_MASTER_HANDOFF_PRIVATE.md)
