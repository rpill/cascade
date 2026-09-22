# Pikabu backend setup

Cascade uses Pikabu as the visible platform/auth SDK and Cloudflare Worker + D1 as the Pikabu cloud backend.

```text
Pikabu / static Vite build
        -> Cloudflare Worker (workers.dev)
        -> D1 (cascade-db, binding DB)
```

The browser remains local-first. Authorized cloud operations start only after the Worker verifies Pikabu `getSignedData()` and returns a short-lived bridge session. The Worker stores profiles and the four Pikabu leaderboard datasets in D1. The Yandex build keeps its existing Yandex storage/auth/leaderboard path.

## Prerequisites

- Node.js 22 and pnpm.
- A Cloudflare account using Workers Free.
- The Pikabu game secret.
- A bridge-session signing secret.

Never put `PIKABU_GAME_SECRET` or `BRIDGE_SESSION_SECRET` in a `VITE_*` variable, committed env file, browser log, or frontend response.

## Local verification

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm build:pikabu
```

## First Cloudflare setup

Run these commands in order:

```powershell
pnpm dlx wrangler@4.135.0 login
pnpm dlx wrangler@4.135.0 secret put PIKABU_GAME_SECRET
pnpm dlx wrangler@4.135.0 secret put BRIDGE_SESSION_SECRET
pnpm backend:setup:d1
pnpm backend:test
pnpm backend:build:cloudflare
pnpm backend:deploy:cloudflare
$env:CLOUDFLARE_BACKEND_URL='https://cascade-api.<actual-subdomain>.workers.dev'
$env:CLOUDFLARE_SMOKE_ORIGIN='https://games.pikabu.ru'
pnpm backend:smoke:cloudflare
```

Enter secrets interactively. Do not put secret values on the command line or paste them into logs/chat.

`pnpm backend:setup:d1` is idempotent. It creates or reuses D1 database `cascade-db`, writes exactly one Wrangler binding named `DB`, and applies migrations from `migrations/`. Do not hand-edit a fake D1 UUID into source control.

The deployed Worker URL has this shape:

```text
https://cascade-api.<account-subdomain>.workers.dev
```

## Committed Worker configuration

The committed `wrangler.jsonc` contains the Worker entrypoint, exact CORS allowlist, and the two required secret names. The real D1 database UUID is inserted locally by `pnpm backend:setup:d1` before deployment.

Current allowed origins:

```text
http://localhost:5173
http://127.0.0.1:5173
https://games.pikabu.ru
```

Never use `*` for production CORS.

## Pikabu frontend configuration

The frontend receives only public values:

```env
VITE_PLATFORM_TARGET=pikabu
VITE_BACKEND_URL=https://cascade-api.<actual-subdomain>.workers.dev
```

The GitHub Pikabu deployment workflow reads the Worker URL from repository variable `PIKABU_BACKEND_URL`.

## Free-plan operating boundary

- No payment method is part of this project setup and no paid plan is enabled automatically.
- Free-limit exhaustion is handled as backend unavailability; local play/save continues.
- Repeated Worker error `1102` is a release blocker; do not automatically switch to Workers Paid.
- Backend failure must not corrupt or block the browser-local save. Pending cloud work retries after connectivity returns.

## Legacy local secrets

Do not read, print, copy, or delete old local backend secret files as part of this migration. Retire them manually only after the D1/Pikabu E2E is green.
