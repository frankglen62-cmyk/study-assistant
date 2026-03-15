# Security Guide

## Core Principles

- server-only access to private sources, embeddings, and chunk text
- explicit role checks for admin behavior
- RLS for all user-facing reads and writes
- no service-role secrets in the browser or extension
- revocable extension device auth
- prompt-injection resistance in the AI pipeline

## Data Protection

- `source_files`, `source_versions`, `source_chunks`, and private storage objects are never exposed directly to clients
- retrieval happens through server-side privileged code only
- the extension receives suggestion-oriented output only
- Stripe webhook verification is required before wallet crediting

## Auth Model

### Portal auth

- Supabase bearer tokens identify signed-in portal users
- profile role and account status are checked server-side

### Extension auth

- short-lived pairing code
- HMAC-signed short-lived access token
- opaque hashed refresh token in `extension_tokens`
- installation revocation invalidates future usage

## Prompt Injection Mitigation

- page text is treated as untrusted content
- subject detection and answer generation explicitly instruct the model to ignore page-level instructions
- only retrieved admin-managed study content is used for answer generation
- responses never include raw chunk dumps, embeddings, or internal prompts

## Billing Safety

- pending payments are created server-side
- credits are granted only after verified webhook success
- wallet mutation is executed through a SQL function that also writes the credit ledger
- duplicate webhook crediting is prevented by checking payment status before crediting

## Remaining Hardening Work

- replace in-memory rate limiting with Redis or another durable limiter
- add CSP and secure headers for the web app
- add anomaly detection for repeated device pairing or repeated failed refresh attempts
- add full end-to-end security tests against a disposable Supabase environment
