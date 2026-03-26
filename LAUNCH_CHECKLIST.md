# Launch Checklist

Current release-oriented checklist for the live web app and extension.

## Production Baseline

- [ ] Production URL points to `https://study-assistant-web.vercel.app`
- [ ] Vercel project is `study-assistant-web`
- [ ] GitHub branch is `main`
- [ ] Supabase production keys are configured
- [ ] Stripe production keys and webhook secret are configured
- [ ] Turnstile site key is configured in Vercel
- [ ] Turnstile secret is configured in Supabase

## Build Verification

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes if tests were affected
- [ ] `pnpm --filter @study-assistant/web build` passes
- [ ] `pnpm --filter @study-assistant/extension build` passes when extension code changes

## Current Extension Release

- [ ] `apps/extension/package.json` version matches release target
- [ ] `apps/extension/public/manifest.json` version matches release target
- [ ] `apps/web/src/lib/extension-distribution.ts` matches the same version and timestamp
- [ ] generic ZIP refreshed
- [ ] versioned ZIP refreshed
- [ ] packaged `manifest.json` inside both ZIPs matches the release version

## Auth and Security

- [ ] Google sign-in works
- [ ] Facebook sign-in works if enabled
- [ ] strong password rules are active
- [ ] leaked password protection is enabled
- [ ] CAPTCHA renders on sign-in, sign-up, and forgot password
- [ ] users without MFA do not flash through the authenticator page
- [ ] admin and client account pages show authenticator setup
- [ ] admin and client account pages show email approval and email change controls

## Client Portal Checks

- [ ] dashboard shows extension status card
- [ ] dashboard shows current ZIP version
- [ ] Extension Guide shows current ZIP version and pairing mode
- [ ] account page links cleanly into security and extension actions

## Admin Portal Checks

- [ ] dashboard, users, sources, subjects, and settings load quickly from a fresh sign-in
- [ ] admin account page shows password, MFA, and email security controls
- [ ] sources page loads selected subject data correctly
- [ ] stored Q&A add/edit/delete persists after reload

## Extension Checks

- [ ] sidepanel pairing works without opening a separate onboarding tab
- [ ] request permission works from a direct user gesture
- [ ] pairing code paste and pair flow works
- [ ] unpair action returns the extension to pairing mode
- [ ] Controls and Answering workspaces both render correctly
- [ ] subject picker suggestions appear while typing
- [ ] `Find All Answers` and `Study Results` are visible near the top of Answering

## Admin Data Checks

- [ ] subjects load in admin Sources
- [ ] stored Q&A add/edit/delete works after reload
- [ ] subject and Q&A changes appear in the extension after refresh
- [ ] latest subject list is available to the extension subject picker

## Go-Live Rule

- [ ] all intended files committed
- [ ] pushed to GitHub `main`
- [ ] Vercel deployed the latest commit
- [ ] live portal refreshed
- [ ] latest extension ZIP downloaded and reloaded if extension changed
