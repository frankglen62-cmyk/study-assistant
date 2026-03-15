# Architecture Overview

## Product Boundary

Admin-Managed AI Study Assistant is a multi-surface SaaS product composed of:

1. a public marketing website
2. a client portal
3. an admin portal
4. a Chrome extension with a side panel UI
5. a backend API layer hosted inside the Next.js application
6. a private admin-managed source library
7. a credit wallet and payment system
8. a subject-aware retrieval and answer suggestion pipeline

The system is explicitly designed to avoid cheating automation:

- no automatic clicking or submitting
- no hidden background monitoring of all tabs
- no silent scraping without user invocation or enabled live mode
- no raw source leakage to clients or the extension

## Architecture Summary

### 1. Frontend Surfaces

`apps/web` is the single web surface built with Next.js App Router. It contains:

- marketing pages
- auth screens
- client portal pages
- admin portal pages
- internal route handlers under `app/api/*`

This keeps authentication, SSR, route protection, and secure server-side actions in one deployable application.

`apps/extension` is a separate Manifest V3 Chrome extension with:

- a service worker for orchestration
- a side panel UI for session state and answer suggestions
- runtime-injected extraction logic after user action
- local storage for non-secret extension state
- hashed and revocable backend-issued installation tokens

### 2. Backend and Persistence

Supabase Postgres is the system of record. The database holds:

- identity-adjacent profile data
- wallets and credit transactions
- payment records and package catalog
- subjects, categories, folders, sources, versions, and chunks
- sessions and question attempts
- extension installations and extension tokens
- audit logs, notifications, support tickets, and system settings

Supabase Auth handles email/password authentication. Supabase Storage stores private source files in a locked bucket. `pgvector` supports subject-restricted semantic retrieval over processed source chunks.

### 3. Retrieval and Answering Pipeline

The AI pipeline is server-side only.

Core stages:

1. receive sanitized page signals from the client portal or extension
2. determine subject/category using manual override, rules, keywords, and model-assisted classification
3. extract the question and answer options from text and optional screenshot
4. search only active chunks within the permitted subject/category scope
5. re-rank retrieved chunks
6. generate a suggestion-only response with explanation and confidence
7. persist usage, confidence, and observability data

The client never receives:

- raw chunk text beyond minimal answer-context needed for explanation
- embeddings
- storage URLs
- full source documents
- internal prompts

### 4. Credit and Billing Model

The wallet is stored in integer seconds. Billing is event-driven:

- users buy top-up packages
- provider webhooks confirm payments
- credits are provisioned only after verified webhook success
- active sessions debit credits in controlled intervals
- idle sessions auto-pause
- revoked or suspended users cannot continue using the service

Stripe is implemented first through a provider abstraction so PayMongo can be added without changing portal or wallet semantics.

### 5. Security Model

Security defaults are conservative:

- Row Level Security protects all user-facing tables
- source and chunk tables are not exposed to clients
- all privileged retrieval happens server-side
- admin routes require explicit role checks
- extension tokens are stored hashed
- storage is private
- sensitive mutations create audit logs
- webhook handlers are idempotent and signature-verified
- page content is treated as untrusted prompt input

## Bounded Contexts

### Auth and Identity

- Supabase Auth
- profile bootstrap
- role and account status enforcement
- extension pairing and device revocation

### Content Library

- subjects
- categories
- folder tree
- source files
- source versions
- source chunk lifecycle
- processing jobs

### AI Assist

- page extraction normalization
- subject/category detection
- question extraction
- retrieval
- answer generation
- confidence scoring

### Billing and Wallets

- package catalog
- checkout creation
- webhook verification
- wallet ledger
- refunds and admin adjustments

### Sessions and Analytics

- session lifecycle
- usage debits
- question attempts
- low-confidence trends
- no-match reporting
- audit logs

## Key Runtime Flows

### Admin Upload and Ingestion

1. Admin uploads a file from the Sources page.
2. Web route validates role, file type, and size.
3. File is stored in a private Supabase Storage bucket.
4. `source_files` and `source_processing_jobs` records are created.
5. Server extracts text, falls back to OCR or vision when necessary, chunks content, generates embeddings, and writes `source_chunks`.
6. The source is activated on success or marked failed with a retryable error state.
7. An audit log is written for the mutation.

### Client Extension Analysis

1. User opens the side panel and explicitly starts a session.
2. The extension reads the active tab only after user action.
3. Page signals are sent to the backend with the installation token.
4. Server validates installation, user, wallet, and session status.
5. Detection and retrieval run under server-only privileges.
6. Structured answer JSON returns subject, category, suggestion, explanation, and confidence.
7. The side panel shows the result and updated credits.

### Payment Confirmation

1. Client creates a checkout session from the portal.
2. Provider redirects the user through the hosted payment flow.
3. Webhook event is received and verified server-side.
4. A payment record is updated idempotently.
5. Wallet balance and credit transaction ledger are updated inside a transaction.
6. The client portal reflects the new balance from the database, not the redirect URL.

### Extension Pairing

1. Logged-in client requests a short-lived pairing code from the web app.
2. Extension onboarding accepts the code.
3. Backend exchanges the code for an installation record and short-lived token pair.
4. Extension stores the token locally.
5. Refresh and revocation flows are server-controlled.

## Deployment Topology

### Web Application

- Next.js application deployed to a platform suited for App Router and route handlers
- server-only environment variables for OpenAI, Stripe, Supabase service role, and extension secrets

### Database

- Supabase Postgres with `pgvector`
- private storage bucket for source materials
- migrations under source control

### Extension

- packaged independently and distributed through Chrome Web Store or controlled enterprise distribution
- points to the deployed web application API base URL

## Assumptions

1. Package management uses `pnpm` workspaces and Turborepo for a predictable monorepo workflow.
2. The web application will keep route handlers in `apps/web` instead of spinning up a separate backend service unless later scaling data proves a split is necessary.
3. Admin and client experiences share a single Next.js deployment but use separate route groups, server guards, and navigation shells.
4. Source ingestion runs in server-side jobs invoked from the app initially; if volume grows, the ingestion worker can be extracted behind the same database contract.
5. Billing starts with Stripe one-time top-ups and leaves subscription support wired into the same provider abstraction.
6. Live Assist remains opt-in, throttled, and limited to meaningful page changes.
7. A fair charging rule will be implemented in Phase 5: no debit on transport or validation failure, reduced or zero debit on explicit no-match before meaningful retrieval, normal debit once answer generation begins inside an active session window.
8. Folder deletion will default to archive or soft delete; hard delete is allowed only for empty and safe records.
9. The extension uses explicit pairing tokens rather than relying on shared browser cookies.
10. The initial implementation targets modern Chromium browsers and a desktop-first admin experience while remaining responsive on mobile for client portal pages.

## Recommended Repository Tree

```text
.
|-- README.md
|-- package.json
|-- pnpm-workspace.yaml
|-- turbo.json
|-- tsconfig.base.json
|-- .editorconfig
|-- .gitignore
|-- .prettierrc.json
|-- apps
|   |-- web
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   |-- next.config.ts
|   |   |-- postcss.config.mjs
|   |   |-- tailwind.config.ts
|   |   `-- src
|   |       |-- app
|   |       |   |-- (public)
|   |       |   |   |-- page.tsx
|   |       |   |   |-- features/page.tsx
|   |       |   |   |-- pricing/page.tsx
|   |       |   |   `-- contact/page.tsx
|   |       |   |-- (auth)
|   |       |   |   |-- login/page.tsx
|   |       |   |   |-- register/page.tsx
|   |       |   |   |-- forgot-password/page.tsx
|   |       |   |   `-- reset-password/page.tsx
|   |       |   |-- (client)
|   |       |   |   |-- dashboard/page.tsx
|   |       |   |   |-- sessions/page.tsx
|   |       |   |   |-- buy-credits/page.tsx
|   |       |   |   |-- usage-logs/page.tsx
|   |       |   |   |-- settings/page.tsx
|   |       |   |   |-- account/page.tsx
|   |       |   |   `-- extension-guide/page.tsx
|   |       |   |-- (admin)
|   |       |   |   |-- dashboard/page.tsx
|   |       |   |   |-- sources/page.tsx
|   |       |   |   |-- subjects/page.tsx
|   |       |   |   |-- categories/page.tsx
|   |       |   |   |-- users/page.tsx
|   |       |   |   |-- payments/page.tsx
|   |       |   |   |-- sessions/page.tsx
|   |       |   |   |-- reports/page.tsx
|   |       |   |   |-- audit-logs/page.tsx
|   |       |   |   `-- settings/page.tsx
|   |       |   |-- api
|   |       |   |   |-- auth
|   |       |   |   |   |-- extension/pair/route.ts
|   |       |   |   |   |-- extension/exchange/route.ts
|   |       |   |   |   |-- extension/refresh/route.ts
|   |       |   |   |   `-- logout/route.ts
|   |       |   |   |-- client
|   |       |   |   |   |-- wallet/route.ts
|   |       |   |   |   |-- sessions/start/route.ts
|   |       |   |   |   |-- sessions/pause/route.ts
|   |       |   |   |   |-- sessions/resume/route.ts
|   |       |   |   |   |-- sessions/end/route.ts
|   |       |   |   |   |-- analyze/route.ts
|   |       |   |   |   |-- settings/route.ts
|   |       |   |   |   |-- payments/create-checkout/route.ts
|   |       |   |   |   |-- payments/history/route.ts
|   |       |   |   |   `-- devices/revoke/route.ts
|   |       |   |   |-- admin
|   |       |   |   |   |-- subjects/route.ts
|   |       |   |   |   |-- categories/route.ts
|   |       |   |   |   |-- folders/route.ts
|   |       |   |   |   |-- sources/upload/route.ts
|   |       |   |   |   |-- sources/[id]/reprocess/route.ts
|   |       |   |   |   |-- sources/[id]/activate/route.ts
|   |       |   |   |   |-- sources/[id]/archive/route.ts
|   |       |   |   |   |-- users/route.ts
|   |       |   |   |   |-- users/[id]/credits/route.ts
|   |       |   |   |   |-- payments/route.ts
|   |       |   |   |   |-- reports/summary/route.ts
|   |       |   |   |   `-- audit-logs/route.ts
|   |       |   |   `-- webhooks
|   |       |   |       |-- stripe/route.ts
|   |       |   |       `-- paymongo/route.ts
|   |       |   |-- components
|   |       |   |   |-- layout
|   |       |   |   |-- forms
|   |       |   |   |-- tables
|   |       |   |   |-- feedback
|   |       |   |   `-- charts
|   |       |   |-- features
|   |       |   |   |-- auth
|   |       |   |   |-- admin
|   |       |   |   |-- client
|   |       |   |   |-- ai
|   |       |   |   |-- payments
|   |       |   |   |-- sources
|   |       |   |   |-- sessions
|   |       |   |   `-- reports
|   |       |   |-- lib
|   |       |   |   |-- ai
|   |       |   |   |-- env
|   |       |   |   |-- observability
|   |       |   |   |-- payments
|   |       |   |   |-- security
|   |       |   |   `-- supabase
|   |       |   `-- styles
|   |       |       `-- globals.css
|   |       |-- middleware.ts
|   |       `-- instrumentation.ts
|   `-- extension
|       |-- package.json
|       |-- tsconfig.json
|       |-- public
|       |   `-- manifest.json
|       `-- src
|           |-- background
|           |   `-- service-worker.ts
|           |-- content
|           |   `-- extractor.ts
|           |-- sidepanel
|           |   |-- index.html
|           |   |-- main.tsx
|           |   `-- components
|           |-- onboarding
|           |   `-- index.html
|           `-- lib
|               |-- api.ts
|               |-- auth.ts
|               |-- chrome.ts
|               |-- state.ts
|               `-- validators.ts
|-- packages
|   |-- shared-types
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   `-- src
|   |       `-- index.ts
|   |-- shared-utils
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   `-- src
|   |       `-- index.ts
|   `-- ui
|       |-- package.json
|       |-- tsconfig.json
|       `-- src
|           |-- index.ts
|           |-- components
|           `-- styles
|-- supabase
|   |-- migrations
|   |   |-- 0001_core_schema.sql
|   |   |-- 0002_rls_policies.sql
|   |   |-- 0003_functions_and_triggers.sql
|   |   `-- 0004_storage_and_vector_indexes.sql
|   `-- seed
|       `-- seed.sql
`-- docs
    |-- architecture.md
    |-- api.md
    |-- security.md
    |-- setup.md
    |-- deployment.md
    `-- qa-checklist.md
```
