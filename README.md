# Admin-Managed AI Study Assistant

Production-oriented monorepo for a SaaS study assistant with:

- a public marketing site
- a client portal
- an admin portal
- a Chrome side-panel extension
- server-side AI retrieval against admin-managed private sources
- credit-based billing with Stripe top-ups
- secure extension pairing and revocation

## Current Scope

Implemented across Phases 1-5:

- monorepo scaffold and shared packages
- Supabase schema, RLS, triggers, storage configuration, and runtime SQL helpers
- public/client/admin web UI scaffold
- MV3 Chrome extension with onboarding, pairing, side panel, extraction, and Live Assist controls
- backend env validation, server auth helpers, extension token flow, wallet/session APIs, Stripe checkout/webhook handling, and AI retrieval pipeline
- docs, demo seed data, and Vitest test scaffold

## Safety Boundary

The product is intentionally suggestion-only:

- no auto-clicking answers
- no auto-submitting forms
- no silent all-tab monitoring
- no raw source file, chunk, embedding, or private storage leakage to clients
- page content is treated as untrusted input, not instructions

## Workspace

- `apps/web`: Next.js App Router app for the public site, client portal, admin portal, and route handlers
- `apps/extension`: Chrome extension (Manifest V3)
- `packages/shared-types`: shared domain types and DTOs
- `packages/shared-utils`: shared helpers and constants
- `packages/ui`: reusable web UI primitives
- `supabase/migrations`: schema, RLS, storage, and runtime SQL helpers
- `supabase/seed/demo_seed.sql`: demo data seed
- `docs`: architecture, API, security, setup, deployment, and QA docs

## Local Setup

1. Install `pnpm` and Node.js 20+.
2. Copy [apps/web/.env.example](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/.env.example) to `apps/web/.env.local`.
3. Copy [apps/extension/.env.example](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/.env.example) if you want a default extension app URL during local work.
4. Create a Supabase project with `pgvector` enabled.
5. Apply SQL files in `supabase/migrations` in order.
6. Run the demo seed only after your auth users exist: [supabase/seed/demo_seed.sql](/c:/Users/glenn/Documents/NEW%20PROJECT/supabase/seed/demo_seed.sql).
7. Install dependencies with `pnpm install`.
8. Start the web app with `pnpm dev:web`.
9. Build the extension from `apps/extension` with `pnpm --filter @study-assistant/extension build`.

## Environment Variables

Required web env vars:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` optional for OpenAI-compatible providers such as NVIDIA
- `OPENAI_API_COMPAT_MODE` `responses` or `chat_completions`
- `OPENAI_SUPPORTS_IMAGE_INPUT` `true` or `false`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EXTENSION_PAIRING_SECRET`
- `SESSION_IDLE_SECONDS`
- `LOW_CREDIT_THRESHOLD_SECONDS`
- `MAX_UPLOAD_SIZE_MB`

Optional model overrides:

- `OPENAI_EXTRACTION_MODEL`
- `OPENAI_ANSWER_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_SUBJECT_MODEL`

OpenAI-compatible providers:

- the web app can use the native OpenAI Responses API or an OpenAI-compatible `chat.completions` provider
- when using a compatibility endpoint such as NVIDIA, set `OPENAI_BASE_URL`, switch `OPENAI_API_COMPAT_MODE=chat_completions`, and disable image input unless the chosen model supports it
- the extension still talks only to the web app backend; AI keys never belong in the browser extension

## Core Backend Flows

### Extension pairing

1. Logged-in client requests `/api/auth/extension/pair`.
2. The web app returns a short-lived pairing code.
3. Extension onboarding submits the code to `/api/auth/extension/exchange`.
4. The server creates an `extension_installations` row, stores a hashed refresh token, and returns an HMAC-signed access token plus refresh token.
5. The extension refreshes via `/api/auth/extension/refresh`.
6. Revocation blocks future extension API usage.

### Portal API auth

- route handlers accept an explicit Supabase bearer token when one is provided
- client portal requests can also authenticate via the normal Supabase auth cookies
- extension routes remain installation-token based and do not rely on cookies

### Wallet and session usage

1. The extension or portal starts a session via `/api/client/sessions/start`.
2. `/api/client/analyze` validates the active session, detects subject/category, extracts the question, retrieves scoped chunks, and generates a suggestion.
3. Successful answer-generation debits `60` seconds through the SQL wallet function.
4. Detection-only and no-match attempts do not debit by default.

### Stripe top-ups

1. The portal calls `/api/client/payments/create-checkout`.
2. The server creates a pending `payments` row and a Stripe Checkout Session.
3. `/api/webhooks/stripe` verifies the signature and credits seconds only after a verified completion event.
4. Wallet mutation and credit ledger creation are handled server-side.

### Live portal data

- `/api/client/devices` returns the signed-in client's paired installations
- `/api/public/payment-packages` returns the active package catalog for pricing and buy-credit screens

## Commands

- `pnpm dev:web`
- `pnpm typecheck`
- `pnpm test`
- `pnpm format`

## Extension Loading

1. Build the extension workspace.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Load the built `apps/extension/dist` directory as an unpacked extension.
5. Open the onboarding page, enter the app URL, grant origin permission, and paste the pairing code from the client portal.

## Testing

Current automated coverage includes:

- shared utility behavior
- extension token creation/verification
- manual subject override behavior
- payment service orchestration with mocked Stripe/Supabase dependencies
- analyze service orchestration with mocked detection/retrieval/answering dependencies

Run tests with `pnpm test`.

## Key Docs

- [Architecture](/c:/Users/glenn/Documents/NEW%20PROJECT/docs/architecture.md)
- [API](/c:/Users/glenn/Documents/NEW%20PROJECT/docs/api.md)
- [Security](/c:/Users/glenn/Documents/NEW%20PROJECT/docs/security.md)
- [Setup](/c:/Users/glenn/Documents/NEW%20PROJECT/docs/setup.md)
- [Deployment](/c:/Users/glenn/Documents/NEW%20PROJECT/docs/deployment.md)
- [QA Checklist](/c:/Users/glenn/Documents/NEW%20PROJECT/docs/qa-checklist.md)

## Known Limitations

- The repo includes production-oriented code paths, but dependencies were not installed or build-verified in this environment.
- Rate limiting is currently in-memory and should be replaced with Redis or a durable store in multi-instance production.
- Source ingestion worker extraction/OCR is not fully implemented in Phase 5; the retrieval pipeline assumes processed chunks already exist.
- The client portal pages are scaffolded, but not every page is wired to live APIs yet.

## Future Roadmap

- complete admin source ingestion worker with OCR and file parsing
- wire live portal pages to the new route handlers
- add PayMongo provider implementation behind the same billing abstraction
- move rate limiting and background jobs to durable infrastructure
- add end-to-end tests against a disposable Supabase stack
