# Local Setup

## Prerequisites

- Node.js 20+
- `pnpm`
- Supabase project with `pgvector`
- Stripe test account
- OpenAI API key

## Steps

1. Copy [apps/web/.env.example](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/.env.example) to `apps/web/.env.local`.
2. Copy [apps/extension/.env.example](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/.env.example) if desired.
3. Apply migrations in `supabase/migrations` in order.
4. Create auth users in Supabase Auth that match the UUIDs in [supabase/seed/demo_seed.sql](/c:/Users/glenn/Documents/NEW%20PROJECT/supabase/seed/demo_seed.sql), or replace those UUIDs with your own.
5. Run the demo seed.
6. Install dependencies with `pnpm install`.
7. Start the web app with `pnpm dev:web`.
8. Build the extension with `pnpm --filter @study-assistant/extension build`.

## Portal Route Auth

The web app can call route handlers with the normal Supabase session cookies. External callers can use a Supabase bearer token instead. The extension pairing and analyze flows continue to use installation-scoped bearer tokens and do not depend on shared cookies.

## Stripe Webhooks

Use the Stripe CLI or dashboard to forward events to:

`/api/webhooks/stripe`

Recommended events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`

## Extension Pairing Flow

1. Sign in to the client portal.
2. Request a pairing code from the extension page or account devices page.
3. Open the extension onboarding screen.
4. Enter the app URL.
5. Grant connection permission for that origin.
6. Paste the pairing code.
7. Complete pairing and confirm credits/session state in the side panel.
