# Security Checklist and Incident Runbook

## Current Security Posture

- web app auth is handled by Supabase-backed portal sessions
- extension auth is handled by paired installation tokens, not shared browser cookies
- pairing requires a short-lived portal-generated code
- the extension must request portal host permission from a direct user gesture
- sidepanel analysis is explicit and tied to the active tab flow
- Google and Facebook social sign-in are supported
- Turnstile protects sign-in, sign-up, and password recovery
- authenticator app MFA is available for admin and client accounts
- email approval security is available for admin and client accounts
- security headers are enforced through Next.js response headers

## Pre-Release Security Checks

### Auth and authorization

- [ ] admin routes require admin role checks
- [ ] client routes require signed-in portal users
- [ ] new passwords must meet the current strong-password policy
- [ ] leaked password protection is enabled in Supabase Auth
- [ ] CAPTCHA is enabled in Supabase Auth for sign in, sign up, and password recovery
- [ ] optional TOTP MFA is enabled in Supabase Auth and tested end to end
- [ ] users without MFA enabled are not routed through the authenticator challenge
- [ ] email approval security is tested for admin and client users
- [ ] extension routes validate paired installation ownership
- [ ] revoked installations cannot continue using protected routes
- [ ] unpaired extensions cannot access protected client APIs

### Secrets and data

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-only
- [ ] `OPENAI_API_KEY` is server-only
- [ ] `EXTENSION_PAIRING_SECRET` is server-only
- [ ] raw source files remain private
- [ ] source chunks and embeddings are not returned to client responses
- [ ] portal responses expose only the intended answer metadata and UI state
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is public-only and not confused with the Turnstile secret

### Cookies and browser protections

- [ ] custom security cookies use `HttpOnly` and `Secure`
- [ ] Supabase session cookies use secure production defaults
- [ ] CSP, HSTS, frame, referrer, and permissions headers are active
- [ ] auth responses are not cacheable in shared caches

### Extension permissions

- [ ] portal origin permission is requested only from a user click
- [ ] current site access is requested only when needed
- [ ] unsupported browser pages are handled safely
- [ ] extension state resets cleanly after revoke or unpair

### Rate limiting

- [ ] analyze route limit matches current code configuration
- [ ] auth and device mutation routes still use route limiters
- [ ] repeated failures or timeouts are logged without leaking secrets

## Operational Security Notes

- extension updates require a rebuilt ZIP and manual reload of the unpacked extension
- local editor files such as `.vscode/` and build caches should not be committed by accident
- production visibility always depends on GitHub push plus Vercel deployment, not local edits
- Turnstile needs `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel plus the matching Cloudflare secret configured inside Supabase Auth
- leaked password protection and built-in password rules are controlled in Supabase Auth settings, not by application code alone
- auth metadata is the source of truth for email approval security, with a DB mirror in `profiles.email_2fa_enabled`

## Incident Runbook

### 1. Extension cannot pair

Check:

1. portal pairing code was freshly generated
2. portal host permission was granted
3. installation is not revoked
4. production URL matches the trusted portal URL

### 2. Subject picker or extension data is stale

Check:

1. admin subject and Q&A changes were saved successfully
2. portal subject catalog endpoint returns current data
3. extension subject picker refreshes after open, refresh, or focus
4. latest ZIP is actually reloaded in Chrome

### 3. Payment credited incorrectly

Check:

1. `payments` status
2. `credit_transactions` idempotency
3. Stripe webhook delivery logs

### 4. Wrong subject or answer routing

Check:

1. LMS page header and course code extraction
2. current manual subject override
3. stored Q&A duplicates or conflicting rows
4. Study Results source folder and confidence

### 5. Live app does not reflect local changes

Check:

1. commit exists locally
2. commit was pushed to GitHub `main`
3. Vercel deployed that exact commit
4. extension ZIP was refreshed if extension code changed

### 6. CAPTCHA fails to load

Check:

1. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` exists in Vercel
2. Turnstile secret exists in Supabase Auth
3. the browser is not blocking `challenges.cloudflare.com`
4. retry in another browser if Brave Shields or privacy filters interfere
