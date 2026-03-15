# QA Checklist — Admin-Managed AI Study Assistant

Manual verification matrix for pre-launch quality assurance.

---

## Authentication Flows

- [ ] Client login with valid credentials → redirected to client dashboard
- [ ] Client login with invalid credentials → error shown, no redirect
- [ ] Admin login with valid credentials → redirected to admin dashboard
- [ ] Admin login blocked for client-role accounts
- [ ] Register new client account → account created, redirected to login
- [ ] Forgot password → reset email sent (or stub message shown)
- [ ] Reset password → password updated successfully
- [ ] Suspended account login → access blocked with appropriate message

---

## Admin Flows

- [ ] Admin dashboard loads with live metrics (users, sessions, credits, confidence)
- [ ] Subject creation → subject and root folder created, audit log written
- [ ] Subject update → fields updated, audit log written
- [ ] Category creation with subject association → category created
- [ ] Category update → fields updated, audit log written
- [ ] Folder creation (child folder type) → folder created under parent
- [ ] Source file upload → file stored in private bucket, source record created
- [ ] Source processing → extraction, normalization, chunking, embedding insertion succeed
- [ ] Source processing failure → job marked as failed, error logged
- [ ] Source activation → status set to active
- [ ] Source deactivation → status set to draft
- [ ] Source reprocessing → old chunks replaced, new embeddings generated
- [ ] User credit adjustment (add) → wallet balance increases, credit_transaction created, audit logged
- [ ] User credit adjustment (subtract) → wallet balance decreases, negative balance blocked
- [ ] User suspend → account status set to suspended, audit logged
- [ ] User reactivate → account status set to active, audit logged
- [ ] Admin payments page → shows live payment history with gross revenue
- [ ] Admin sessions page → shows live session list with suspicious flags
- [ ] Admin audit logs page → shows recent audit entries with actor details
- [ ] Admin reports page → shows revenue, usage highlights, recent findings

---

## Client Flows

- [ ] Client dashboard shows live wallet balance, session status, recent subjects
- [ ] Sessions page shows active session info and history table
- [ ] Buy Credits page shows available packages with correct pricing
- [ ] Settings page loads and saves detection mode preference
- [ ] Account page shows paired devices and billing history
- [ ] Extension guide page shows 10-step setup and troubleshooting

---

## Payment Flow

- [ ] Checkout creation → Stripe checkout session opened
- [ ] Checkout return URLs validated (reject external origins)
- [ ] Successful Stripe payment → webhook received, payment marked paid
- [ ] Wallet credited once (idempotent) after successful payment
- [ ] Webhook duplicate handling → no double crediting
- [ ] Expired checkout → payment marked canceled
- [ ] Payment history → shows all transactions with correct status

---

## Extension Pairing Flow

- [ ] Generate pairing code from client portal → code shown with expiry
- [ ] Exchange pairing code → access token + refresh token returned
- [ ] Invalid/expired code exchange → error returned
- [ ] Token refresh → new access token issued
- [ ] Revoke device → installation marked revoked, audit logged
- [ ] Revoked device cannot use access token for protected actions
- [ ] Re-pair after revoke → new installation created

---

## Analyze Flow

- [ ] Analyze with active session → subject detected, answer returned
- [ ] Analyze without active session → error (no session)
- [ ] Analyze with zero credits → error (insufficient credits)
- [ ] Analyze with locked wallet → error (wallet locked)
- [ ] Low confidence result → confidence warning shown
- [ ] No match result → no-match message, no raw chunks leaked
- [ ] Rate limit exceeded → 429 response after excessive requests
- [ ] Response contains no raw source text, chunk content, or storage paths

---

## Security & Error Handling

- [ ] 404 page renders for unknown routes
- [ ] Public error boundary renders for public page errors
- [ ] Client error boundary renders for client portal errors
- [ ] Admin error boundary renders for admin portal errors
- [ ] Global error fallback renders when root layout fails
- [ ] No stack traces or sensitive details visible in error pages
- [ ] Rate limiting active on: analyze, checkout, session start/end, pair, exchange, refresh, revoke, admin credits, admin status
- [ ] Rate limit rejection logged with monitoring context

---

## Legal & Public Pages

- [ ] Privacy Policy page renders at /privacy
- [ ] Terms of Service page renders at /terms
- [ ] Footer links to Privacy and Terms visible on all public pages
- [ ] Landing page renders correctly (hero, features, pricing teaser, FAQ)
- [ ] Contact page renders with form
