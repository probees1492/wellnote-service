# WellNote Service — Deployment Guide

Two deployable units live in this monorepo:

| Path       | Runtime                | Deploy target           |
| ---------- | ---------------------- | ----------------------- |
| `backend/` | Cloudflare Workers     | `wrangler deploy --env` |
| `web/`     | Next.js (static build) | Cloudflare Pages        |

---

## 1. Environment matrix

| Environment | Branch trigger | Worker name          | Pages project          | Suggested URLs                                              |
| ----------- | -------------- | -------------------- | ---------------------- | ----------------------------------------------------------- |
| dev         | `develop`      | `wellnote-api-dev`   | `wellnote-web-dev`     | `api-dev.wellnote.app` / `dev.wellnote.app`                 |
| stage       | `release/*`    | `wellnote-api-stage` | `wellnote-web-stage`   | `api-stage.wellnote.app` / `stage.wellnote.app`             |
| prod        | `main` + tag   | `wellnote-api-prod`  | `wellnote-web-prod`    | `api.wellnote.app` / `wellnote.app`                         |

Prod deploys are gated by the GitHub Environment `prod` (configure required
reviewers in repo Settings → Environments).

---

## 2. One-time Cloudflare resource setup

Run these from your laptop (logged in via `wrangler login`). Replace IDs in
`backend/wrangler.jsonc` afterwards.

```bash
cd backend

# D1 databases (one per environment)
pnpm wrangler d1 create wellnote-dev
pnpm wrangler d1 create wellnote-stage
pnpm wrangler d1 create wellnote-prod

# R2 buckets
pnpm wrangler r2 bucket create wellnote-memos-dev
pnpm wrangler r2 bucket create wellnote-memos-stage
pnpm wrangler r2 bucket create wellnote-memos-prod

# KV namespaces for sessions
pnpm wrangler kv namespace create wellnote-sessions-dev
pnpm wrangler kv namespace create wellnote-sessions-stage
pnpm wrangler kv namespace create wellnote-sessions-prod
```

Paste the printed `database_id` / `id` values into
`backend/wrangler.jsonc` under the matching `env.<env>` block.

Pages projects can be created via dashboard, or once via:

```bash
pnpm wrangler pages project create wellnote-web-dev   --production-branch=develop
pnpm wrangler pages project create wellnote-web-stage --production-branch=stage
pnpm wrangler pages project create wellnote-web-prod  --production-branch=main
```

---

## 3. Secrets

### GitHub repo secrets (Settings → Secrets and variables → Actions)

| Secret                  | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token with `Workers Scripts:Edit`, `D1:Edit`, `R2:Edit`, `KV:Edit`, `Pages:Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id               |

Optional per-environment overrides can go into GitHub Environments
(`dev`, `stage`, `prod`) for stricter approval gating.

### Worker secrets (per environment)

Set these directly against Cloudflare — they never live in GitHub Actions logs.

```bash
cd backend

for ENV in dev stage prod; do
  pnpm wrangler secret put JWT_SECRET           --env $ENV
  pnpm wrangler secret put JWT_REFRESH_SECRET   --env $ENV
  pnpm wrangler secret put KEK_MASTER           --env $ENV
done
```

Use distinct values per environment. Rotate by re-running `secret put`.

---

## 4. First deploy

1. Confirm Cloudflare resources exist and IDs are pasted into `wrangler.jsonc`.
2. Configure GitHub secrets above.
3. Push `develop` branch → `Deploy Backend` + `Deploy Web` workflows fire
   automatically for the `dev` environment.
4. Cut a `release/x.y.z` branch from `develop` to deploy to `stage`.
5. When stable, merge into `main`. `release-please` will open a release PR;
   merging that PR creates a `vX.Y.Z` tag and triggers prod deploys
   (subject to manual approval if the `prod` GitHub Environment is gated).

Manual override:

```text
gh workflow run deploy-backend.yml -f environment=stage
gh workflow run deploy-web.yml     -f environment=stage
```

---

## 5. Release flow (release-please)

- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, …).
- `release.yml` watches `main` and opens/updates a Release PR.
- Merging the Release PR:
  - bumps `CHANGELOG.md`
  - tags `vX.Y.Z`
  - creates a GitHub Release
- Tag push triggers no extra deploy; deploys are tied to the `main` branch push
  that already happened. (Add a `tags: [v*]` trigger to `deploy-*.yml` if you
  prefer tag-gated prod deploys instead of branch-gated.)

---

## 6. Rollback

### Backend (Worker)

```bash
cd backend
pnpm wrangler deployments list --env prod
pnpm wrangler rollback <deployment-id> --env prod
```

### Web (Pages)

Cloudflare dashboard → Pages → project → Deployments → "Rollback".

### Database

D1 has no automatic rollback. Restore from the most recent backup or write a
compensating migration. Never re-run a destructive migration on prod without a
fresh export:

```bash
pnpm wrangler d1 export wellnote-prod --env prod --output ./backup.sql
```

---

## 7. Known limitations

- Production secrets (`JWT_SECRET`, `KEK_MASTER`, …) must be set out-of-band
  with `wrangler secret put`. They are never committed.
- The Pages action assumes a static export; if the app starts using Next.js
  server runtime features, switch to `@cloudflare/next-on-pages`.
- `release-please` here treats the repo as a single Node package. Splitting
  per-app releases is possible later by moving the manifest to per-path
  components.
