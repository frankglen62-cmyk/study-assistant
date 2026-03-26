# Admin-Managed AI Study Assistant

Production monorepo for a study platform with:

- public website
- client portal
- admin portal
- Chrome side panel extension
- paired browser and device workflow
- admin-managed subject and Q&A library
- session-based usage tracking and billing
- server-side subject detection and answer retrieval

## Current Live State

- Production web app: `https://study-assistant-web.vercel.app`
- GitHub repo: `https://github.com/frankglen62-cmyk/study-assistant.git`
- Production branch: `main`
- Vercel project: `study-assistant-web`
- Current extension release: `v0.1.45`

## Current Shipped Features

### Public website

- dark landing pages for `Home`, `Features`, `Pricing`, and `Contact`
- animated hero, pricing, and section transitions
- Google sign-in and Facebook sign-in
- Turnstile security check on sign-in, sign-up, and password recovery
- pricing in PHP with hover-driven card emphasis

### Client portal

- dashboard with extension status, paired browser state, and current ZIP version
- Extension Guide with highlighted pairing mode and current download release
- account page with password change, authenticator app MFA, email approval security, and email change flow
- session, wallet, settings, and usage pages

### Admin portal

- dashboard, users, payments, reports, audit logs, sessions, subjects, categories, and sources
- admin account page with password change, authenticator app MFA, email approval security, and email change flow
- admin-managed subject folders, subject library, stored Q&A CRUD, and source processing flows

### Extension

- sidepanel-first pairing flow
- request portal permission, paste pairing code, and pair directly in the sidepanel
- manual `Unpair Browser`
- session controls with start, pause, resume, end, and countdown
- split sidepanel workflow:
  - `Controls` for setup, subject mode, session, and logs
  - `Answering` for actions, detection summary, and Study Results
- subject picker with live suggestions and refresh behavior
- auto detect fallback and manual subject lock
- `New Exam`, `Full Auto`, `Select All`, and `Find All Answers`
- current subject shown at the top of the Answering workspace

### Retrieval and matching improvements

- blank-aware matching for fill-in-the-blank questions
- repeated-question disambiguation
- LMS control text filtering such as `Clear my choice`
- LMS header and course-code aware subject detection
- fresher subject and Q&A cache behavior so admin changes appear faster
- safer MFA handling so users without MFA do not flash through the authenticator screen

### Security

- Supabase Auth for portal users
- Google and Facebook OAuth
- strong password rules
- leaked-password protection in Supabase
- Turnstile CAPTCHA for auth flows
- optional authenticator app MFA
- optional email approval security flow
- hardened security headers
- safer Supabase session cookie defaults

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
- subject and Q&A changes should surface to the extension after refresh without rebuilding the extension

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
- [AMAUOED_Scraping_Explanation.md](/c:/Users/glenn/Documents/NEW%20PROJECT/AMAUOED_Scraping_Explanation.md)
