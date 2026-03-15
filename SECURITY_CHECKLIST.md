# Security Checklist & Incident Runbook

Pre-launch security verification and production incident response procedures.

---

## Pre-Launch Security Verification

### Authentication & Authorization
- [ ] All API routes require authentication (`requireClientUser`, `requirePortalUser`, or `requireAdminUser`)
- [ ] Admin endpoints only accessible with admin-role tokens
- [ ] Client endpoints only accessible with client-role tokens
- [ ] Extension endpoints verify installation ownership before acting
- [ ] Suspended accounts blocked from all protected actions
- [ ] Pairing codes expire after `EXTENSION_PAIRING_CODE_TTL_SECONDS` (default: 5 min)
- [ ] Extension access tokens expire after `EXTENSION_ACCESS_TOKEN_TTL_SECONDS`
- [ ] Refresh tokens expire after `EXTENSION_REFRESH_TOKEN_TTL_SECONDS`

### Data Protection
- [ ] Raw source files stored in private bucket (no public access)
- [ ] Source chunks and embeddings never returned in client API responses
- [ ] Analyze response contains only: suggestion, explanation, confidence, and detected metadata
- [ ] `server-only` import guard on all server-side modules
- [ ] Service role key never exposed to client-side code
- [ ] No environment variables with sensitive data leaked to frontend

### Rate Limiting
- [ ] Analyze: 120 requests/hour per user
- [ ] Checkout creation: 20 requests/hour per user
- [ ] Session start: 20 requests/hour per user
- [ ] Session end: 30 requests/hour per user
- [ ] Pairing code: 10 requests/10 minutes per user
- [ ] Exchange: 20 requests/10 minutes per IP
- [ ] Refresh: 30 requests/10 minutes per IP
- [ ] Device revoke: 20 requests/hour per user
- [ ] Admin credit adjustment: 120 requests/hour per admin
- [ ] Admin status change: 120 requests/hour per admin
- [ ] Rate limit rejections logged with monitoring context

### Stripe Security
- [ ] Webhook signatures verified via `stripe.webhooks.constructEvent`
- [ ] Checkout return URLs validated against `NEXT_PUBLIC_APP_URL` origin
- [ ] Payment crediting is idempotent (no double credits)
- [ ] Raw Stripe payloads stored for dispute/audit trail

---

## Incident Response Runbook

### 1. Payment Webhook Failures

**Symptoms**: Payments marked as paid in Stripe but wallet not credited.

**Investigation steps**:
1. Check Vercel/server logs for `payment.webhook.credited` or `payment.checkout.created` events.
2. Query `payments` table for the checkout session ID — check `status` field.
3. Query `credit_transactions` table for the payment ID.
4. If payment exists but no credit_transaction, the RPC call may have failed.

**Resolution**:
- Run `apply_payment_credit_once` manually via Supabase SQL editor with the payment ID.
- Check Stripe dashboard to confirm the webhook was delivered and acknowledged.
- If webhooks are consistently failing, verify `STRIPE_WEBHOOK_SECRET` and endpoint URL.

### 2. Extension Auth Failures

**Symptoms**: Extension shows "Not Paired" or tokens continuously expire.

**Investigation steps**:
1. Check `extension_installations` table for the user's devices — verify `installation_status`.
2. Check if the access token TTL is too short for the user's workflow.
3. Check server logs for `rate_limit.rejected` events on the refresh endpoint.

**Resolution**:
- If installation is revoked, user must re-pair from the portal.
- If refresh is rate-limited, user is making too many requests — investigate automation.
- Verify `EXTENSION_PAIRING_SECRET` matches between environments.

### 3. Wallet Balance Mismatch

**Symptoms**: User reports balance doesn't match expected credits.

**Investigation steps**:
1. Query `wallets` table for the user's wallet — check `remaining_seconds`.
2. Query `credit_transactions` table for the user — sum all deltas.
3. Compare sum of transactions to `remaining_seconds` — they should match.
4. Check `payments` table for any duplicate credits.

**Resolution**:
- If discrepancy exists, use admin credit adjustment to correct the balance.
- Write an audit log entry documenting the correction.
- If caused by duplicate webhook credits, review `apply_payment_credit_once` idempotency.

### 4. Source Ingestion Failures

**Symptoms**: Source file uploaded but processing job fails.

**Investigation steps**:
1. Query `processing_jobs` table for the source — check `status` and `error_message`.
2. Check server logs for extraction/chunking/embedding errors.
3. Verify the file format is supported and within size limits.

**Resolution**:
- Fix the underlying issue (file format, API quota, etc.).
- Reprocess the source from the admin Sources page.
- If the file is corrupt, re-upload a clean version.

### 5. General Production Errors

**First checks**:
1. Vercel function logs (or hosting provider logs).
2. Supabase dashboard — check for RLS policy violations or query errors.
3. OpenAI API status page — check for outages.
4. Stripe dashboard — check for webhook delivery failures.

**Escalation path**:
1. Platform operator / lead developer
2. Supabase support (for database/storage issues)
3. OpenAI support (for API quota/rate issues)
4. Stripe support (for payment/webhook issues)
