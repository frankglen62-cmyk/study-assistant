# Deployment Documentation — Admin-Managed AI Study Assistant

---

## Environment Variables

All required environment variables are validated at startup via Zod in `apps/web/src/lib/env/server.ts`.

### Required

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Full URL of the deployed app (e.g., `https://study.example.com`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `OPENAI_API_KEY` | OpenAI API key for extraction, answering, embeddings, and subject detection |
| `STRIPE_SECRET_KEY` | Stripe secret key (live key for production) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `EXTENSION_PAIRING_SECRET` | Shared secret for extension pairing token generation |

### Optional

| Variable | Default | Description |
|---|---|---|
| `SESSION_IDLE_SECONDS` | `300` (5 min) | Idle timeout before session auto-ends |
| `LOW_CREDIT_THRESHOLD_SECONDS` | `900` (15 min) | Threshold for low-credit warnings |
| `MAX_UPLOAD_SIZE_MB` | `25` | Maximum source file upload size |
| `OPENAI_EXTRACTION_MODEL` | `gpt-4.1-mini` | Model for question extraction |
| `OPENAI_ANSWER_MODEL` | `gpt-4.1` | Model for answer generation |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Model for vector embeddings |
| `OPENAI_SUBJECT_MODEL` | `gpt-4.1-mini` | Model for subject/category detection |
| `STRIPE_PRICE_CURRENCY` | `usd` | Default currency for Stripe payments |

---

## Vercel Deployment

### Initial Setup
1. Connect the repository to Vercel.
2. Set root directory to `apps/web` (or configure monorepo settings).
3. Set framework preset to **Next.js**.
4. Configure all required environment variables in the Vercel dashboard.
5. Set the build command: `pnpm --filter @study-assistant/web build`
6. Set the output directory: `.next`

### Build Verification
```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm --filter @study-assistant/web build
```

### Domain Configuration
1. Add custom domain in Vercel project settings.
2. Configure DNS records per Vercel instructions (CNAME or A record).
3. Wait for SSL certificate provisioning (automatic via Vercel).
4. Update `NEXT_PUBLIC_APP_URL` to match the production domain.

---

## Supabase Production Setup

### Project Configuration
1. Create a production Supabase project (separate from development).
2. Copy the production URL and keys to environment variables.
3. Ensure row-level security (RLS) policies are active on all tables.

### Database Migrations
1. Run all SQL migrations against the production database.
2. Verify the following RPC functions exist: `apply_wallet_seconds`, `apply_payment_credit_once`.
3. Verify `pg_vector` extension is enabled for embedding storage.

### Storage Buckets
1. Create the `private-sources` bucket with **private** access policy.
2. Verify service-role key has read/write access to the bucket.
3. Confirm client tokens do NOT have access to the storage bucket.

---

## Stripe Production Setup

### Live Keys
1. Switch from test keys to live keys in the environment variables.
2. Update `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Ensure payment packages in the database reference valid Stripe price IDs (if using `provider_price_reference`).

### Webhook Configuration
1. Create a webhook endpoint in the Stripe dashboard: `https://your-domain.com/api/webhooks/stripe`
2. Subscribe to events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
3. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

---

## Extension Environment Config

The Chrome extension connects to the web app via the user-configured app URL during pairing.
- Ensure `NEXT_PUBLIC_APP_URL` matches the production domain.
- Extension does not require separate environment variables — all configuration is derived from the pairing flow.

---

## Rollback Notes

- **Vercel**: Use the Vercel dashboard to redeploy a previous deployment.
- **Database**: Maintain migration versioning. Be cautious with destructive migrations.
- **Stripe**: Webhook endpoints can be deactivated in the Stripe dashboard immediately.
- **Extension**: Published extension updates cannot easily be rolled back. Test thoroughly before publishing to Chrome Web Store.
