# Deployment Docs

## Current Production Targets

- Production URL: `https://study-assistant-web.vercel.app`
- GitHub repo: `https://github.com/frankglen62-cmyk/study-assistant.git`
- Branch: `main`
- Vercel project: `study-assistant-web`
- Vercel root directory: `apps/web`
- Current extension ZIP release: `v0.1.44`

## Current Deployment Model

### Web app

- source of truth is GitHub `main`
- Vercel auto-deploys from GitHub after push
- anything not committed and pushed is not live

### Extension

- the extension is not auto-updated from source code alone
- the extension must be rebuilt
- the ZIP in `apps/web/public/downloads` must be refreshed
- the updated ZIP must be committed and pushed
- users must download the new ZIP and reload the unpacked extension

## Release Files To Keep In Sync

- [apps/extension/package.json](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/package.json)
- [apps/extension/public/manifest.json](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/extension/public/manifest.json)
- [apps/web/src/lib/extension-distribution.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/lib/extension-distribution.ts)
- [apps/web/public/downloads/study-assistant-extension.zip](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/public/downloads/study-assistant-extension.zip)
- versioned ZIP such as [apps/web/public/downloads/study-assistant-extension-v0.1.44.zip](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/public/downloads/study-assistant-extension-v0.1.44.zip)

## Environment Variables

All required web environment variables are validated in:

- [apps/web/src/lib/env/server.ts](/c:/Users/glenn/Documents/NEW%20PROJECT/apps/web/src/lib/env/server.ts)

Core production values include:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EXTENSION_PAIRING_SECRET`

## Standard Release Workflow

1. Edit code locally.
2. Run relevant checks:

```powershell
pnpm.cmd --filter @study-assistant/extension typecheck
pnpm.cmd --filter @study-assistant/extension build
pnpm.cmd --filter @study-assistant/web build
```

3. If extension code changed, rebuild and refresh both ZIPs.
4. Verify git state:

```powershell
git status --short
```

5. Commit the intended release:

```powershell
git add <files>
git commit -m "describe the change"
```

6. Push:

```powershell
git push origin main
```

7. Verify the latest commit is on GitHub:

```powershell
git log --oneline -5
```

8. Wait for Vercel to deploy the latest commit.
9. Hard refresh the live portal.
10. If the extension changed, re-download and reload the unpacked extension.

## ZIP Refresh Notes

Recommended packaging flow:

1. Build `apps/extension`.
2. If Windows file locks the `dist` output, copy the built files into a temporary staging folder.
3. Create or refresh:
   - `study-assistant-extension.zip`
   - `study-assistant-extension-vX.Y.Z.zip`
4. Confirm the packaged `manifest.json` version matches the intended release.

## Vercel Checks

Before telling anyone that the live app is updated, verify:

- latest Git commit was pushed
- Vercel built from that same commit
- deployment status is `Ready`
- the portal shows the new ZIP version

## Rollback Notes

- Web app rollback: redeploy an earlier GitHub commit from Vercel
- Extension rollback: restore an earlier ZIP and its matching metadata, then push that rollback commit to `main`
