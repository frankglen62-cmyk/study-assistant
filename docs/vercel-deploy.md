# Vercel Deployment Guide

This project can be deployed online on Vercel, but there are two important limits:

- Vercel `Hobby` is free.
- Vercel `Hobby` is for personal, non-commercial use only.
- Since this app has clients, credits, and payment flows, `Hobby` is acceptable for testing and preview, but real production/commercial use should be on `Pro`.

Official references:

- Pricing: https://vercel.com/pricing
- Hobby plan: https://vercel.com/docs/plans/hobby
- Fair use / commercial restriction: https://vercel.com/docs/limits/fair-use-guidelines

## Current repo facts

- Project root: `C:\Users\glenn\Documents\NEW PROJECT`
- Web app: `apps/web`
- Extension: `apps/extension`
- Package manager: `pnpm`
- Framework: `Next.js`
- Workspace file: `pnpm-workspace.yaml`

## What Vercel will deploy

Only the web app is deployed to Vercel:

- public site
- client portal
- admin portal
- API routes under `apps/web/src/app/api`

The Chrome extension is not auto-deployed by Vercel.
It still needs:

- local build
- ZIP refresh
- manual reload or Chrome Web Store distribution

## Before deployment

You need:

1. A Vercel account
2. A GitHub, GitLab, or Bitbucket repository
3. The project committed and pushed to that repo
4. Real production environment variables

## Required environment variables

Use `apps/web/.env.example` as the source of truth.

At minimum, Vercel must have:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` if using a compatible provider
- `OPENAI_API_COMPAT_MODE`
- `OPENAI_SUPPORTS_IMAGE_INPUT`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYMONGO_SECRET_KEY` if used
- `PAYMONGO_WEBHOOK_SECRET` if used
- `PAYMONGO_API_BASE_URL` if used
- `EXTENSION_PAIRING_SECRET`
- `SESSION_IDLE_SECONDS`
- `LOW_CREDIT_THRESHOLD_SECONDS`
- `MAX_UPLOAD_SIZE_MB`
- `OPENAI_EXTRACTION_MODEL`
- `OPENAI_ANSWER_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_SUBJECT_MODEL`

## Step 1: Initialize Git locally

Run from the project root:

```powershell
git init
git add .
git commit -m "Initial deployable version"
```

Then create an empty GitHub repo and connect it:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

## Step 2: Import into Vercel

In Vercel:

1. Click `Add New...` -> `Project`
2. Import your Git repository
3. Set `Root Directory` to:

```text
apps/web
```

4. Framework should detect as `Next.js`
5. Keep package manager as `pnpm`
6. In the project settings, enable:

```text
Include files outside the Root Directory in the Build Step
```

This matters because the web app imports workspace packages from:

```text
packages/shared-types
packages/shared-utils
packages/ui
```

7. Add all environment variables before deploy

## Recommended build settings

Vercel usually detects these automatically, but the working values for this repo are:

- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm --filter @study-assistant/web build`
- Output: managed by Vercel for `Next.js`

## Step 3: Set production app URL

After Vercel gives you a domain, update:

- `NEXT_PUBLIC_APP_URL`

Example:

```text
https://your-app-name.vercel.app
```

This matters for:

- client portal links
- extension pairing
- extension guide instructions

## Step 4: Redeploy after env changes

If you change environment variables in Vercel:

1. save env vars
2. trigger a redeploy

Without redeploy, the old server environment may still be used.

## Step 5: Auto-deploy flow

Once connected, the normal online workflow becomes:

1. AI agent edits code
2. AI agent runs build and tests locally
3. AI agent commits changes
4. AI agent pushes to Git
5. Vercel automatically builds and deploys
6. You open the Vercel URL instead of `localhost`

## Important limitation

Web app changes can auto-deploy online.

Extension changes cannot fully auto-update just because the web app redeployed.

Extension updates still require one of these:

1. Manual ZIP download + `Load unpacked`
2. Chrome Web Store publishing
3. Custom extension update infrastructure

For now, this project uses manual ZIP distribution from the client portal.

## What the next AI agent should do after editing code

### If working locally

If the user says “wala akong nakikitang pagbabago” locally:

1. rebuild the web app
2. restart the web server
3. hard refresh the browser
4. if extension files changed:
   - rebuild extension
   - refresh the ZIP in `apps/web/public/downloads`
   - reload or reinstall the unpacked extension

### If working with Vercel

If the user says “wala akong nakikitang pagbabago” online:

1. confirm the code was actually committed
2. confirm the commit was pushed
3. confirm Vercel finished deployment successfully
4. confirm the user is opening the new deployment URL
5. hard refresh the browser
6. if changes are extension-only, remind that the extension must still be rebuilt/reloaded

## Recommended deployment policy

Use this split:

- `Hobby`: personal testing / preview only
- `Pro`: real production if this app will be used by paying clients or as a commercial product

## Suggested next action

The next practical step is:

1. initialize Git in this project
2. create a GitHub repo
3. push the project
4. import it into Vercel with root directory `apps/web`
5. set all production environment variables

After that, the web app can auto-deploy on every push.
