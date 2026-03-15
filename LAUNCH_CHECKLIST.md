# Launch Checklist — Admin-Managed AI Study Assistant

Final sanity checks before going live.

---

## Environment & Infrastructure

- [ ] All required environment variables set in production (see DEPLOYMENT_DOCS.md)
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Supabase project is production instance (not development)
- [ ] RLS policies active on all tables
- [ ] `private-sources` storage bucket exists with private access
- [ ] `pg_vector` extension enabled
- [ ] RPC functions `apply_wallet_seconds` and `apply_payment_credit_once` deployed
- [ ] DNS configured and SSL certificate active

---

## Payment Gateway

- [ ] Stripe keys are **live** (not test)
- [ ] Stripe webhook endpoint registered for production domain
- [ ] Webhook signing secret matches `STRIPE_WEBHOOK_SECRET`
- [ ] Webhook subscribed to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`
- [ ] At least one active payment package exists in the database
- [ ] Test purchase completed on live Stripe with live keys (refund after verification)

---

## Build Verification

- [ ] `pnpm install --frozen-lockfile` succeeds
- [ ] `pnpm typecheck` passes (0 errors, 5/5 packages)
- [ ] `pnpm test` passes (all tests green)
- [ ] `pnpm --filter @study-assistant/web build` succeeds
- [ ] Deployed build loads without runtime errors

---

## Legal & Compliance

- [ ] Privacy Policy page live at /privacy
- [ ] Terms of Service page live at /terms
- [ ] Footer links visible on all public pages
- [ ] Cookie consent or privacy notice if required by jurisdiction

---

## Chrome Extension

- [ ] Extension manifest version and permissions finalized
- [ ] Extension icon and branding assets ready
- [ ] Chrome Web Store listing copy prepared (name, description, screenshots)
- [ ] Privacy practices disclosure completed for Chrome Web Store
- [ ] Extension tested against production API URL
- [ ] Pairing flow verified end-to-end on production

---

## Core Smoke Tests

- [ ] Landing page loads correctly
- [ ] Login page loads and form validates
- [ ] Registration page loads and form validates
- [ ] Client dashboard loads with live data after login
- [ ] Admin dashboard loads with live data after login
- [ ] Buy credits → Stripe checkout opens
- [ ] Analyze → returns suggestion-only answer
- [ ] Session start/end → wallet debited correctly
- [ ] Extension pairing works from production portal
- [ ] 404 page renders for /nonexistent-route
- [ ] Error boundaries render without leaking details

---

## Operational Readiness

- [ ] Admin account created with valid credentials
- [ ] At least one test client account created
- [ ] At least one subject with active sources processed and embedded
- [ ] Support/contact page accessible
- [ ] Monitoring dashboards or log access configured (Vercel logs, Supabase logs)
- [ ] Incident response contact identified (see SECURITY_CHECKLIST.md)
