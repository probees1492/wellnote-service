# WellNote Backend

Cloudflare Workers + Hono + D1 + R2 + KV.

## Prerequisites

- Node.js 20+
- `pnpm` (preferred) or `npm`
- Wrangler CLI (installed via devDependency)

## Install

```bash
cd backend
pnpm install      # or: npm install
```

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Run `wrangler dev` (Workers dev runtime) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Run all Vitest tests (currently all RED — see TDD note) |
| `pnpm test:unit` | Run only unit tests |
| `pnpm test:integration` | Run only integration tests |
| `pnpm migrate:local` | Apply `migrations/0001_init.sql` to local D1 |

## TDD status

All service/route/cron implementations are stubs that `throw new Error('not implemented')`.
Running `pnpm test` will therefore produce many RED tests on purpose — these tests
encode the SPEC.md business rules and are the implementation target.

## Layout

```
src/
  index.ts                  Hono app entry + scheduled handler
  env.ts                    Bindings interface
  routes/                   Hono route stubs (501)
  services/                 Business logic interfaces + stub impls
  repositories/             D1 access layer interfaces + stub impls
  domain/                   Entity types + constants
  lib/                      time / errors / jwt
  cron/                     Cron handlers
migrations/
  0001_init.sql             Full idempotent schema (D1 / SQLite)
tests/
  unit/                     Service-level RED tests
  integration/              Route + cron RED tests
  helpers/                  Mock D1 / R2 / KV
```

## Implementation order (suggested)

1. `lib/time.ts` — KST helpers (boundary tests will turn green first).
2. `lib/errors.ts` is already concrete; verify route mapping.
3. `services/crypto.service.ts` — implement WebCrypto AES-256-GCM envelope.
4. `repositories/*.repo.ts` — D1 SQL implementations.
5. `services/credit.service.ts` — clamp-aware delta + streak rules.
6. `services/memo.service.ts` — KST-day enforcement + R2 round-trip.
7. `services/activity.service.ts` — 364-day grid from `daily_activity` cache.
8. `services/auth.service.ts` — signup/login/social/refresh + KV sessions.
9. `services/admin.service.ts` — RBAC + audit log.
10. `routes/*.ts` — wire the services; replace 501 stubs.
11. `cron/daily-readonly.ts` — bulk readonly + credit settlement.

## Notes

- KST: all "day" semantics use KST (UTC+9). See `lib/time.ts`.
- Envelope encryption KEK is stored as a base64 secret (`KEK_MASTER`).
- For local testing, repository helpers use `better-sqlite3` to emulate D1.
