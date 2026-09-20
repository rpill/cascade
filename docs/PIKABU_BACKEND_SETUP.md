# Pikabu backend setup

Cascade keeps the Yandex production path unchanged. The backend described here is used by the Pikabu build for cloud profiles and platform-independent leaderboards.

## Prerequisites

- Node.js 20 or newer.
- pnpm matching the existing project workflow.
- Supabase CLI available as `supabase` on `PATH`. On Windows, the official CLI can be installed with Scoop; alternatively install the official `supabase` npm package as a dev dependency and commit the resulting `pnpm-lock.yaml` update.
- A Supabase Free project.
- The Pikabu game secret from the Pikabu developer configuration.

Do not put `PIKABU_GAME_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or any other server credential in a `VITE_*` variable. Vite variables are public browser data.

## Link and deploy

Run these commands from the repository root, in this order:

```bash
pnpm install
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push
pnpm exec supabase secrets set PIKABU_GAME_SECRET=<secret>
pnpm exec supabase secrets set CASCADE_ALLOWED_ORIGINS=https://<pikabu-host>,http://localhost:5173
pnpm exec supabase functions deploy cascade-api --no-verify-jwt --use-api
```

`--use-api` is intentional: `cascade-api` imports shared pure TypeScript code from outside `supabase/functions/`, and API deployment supports that layout without requiring Docker for deployment.

Supabase supplies the function runtime with its own project URL/service-role environment. Do not copy service-role credentials into `.env.pikabu.local`.

## Pikabu client environment

Copy `.env.pikabu.example` to `.env.pikabu.local` and replace only the public project reference:

```text
VITE_PLATFORM_TARGET=pikabu
VITE_BACKEND_URL=https://<project-ref>.supabase.co/functions/v1/cascade-api
```

Then build with:

```bash
pnpm build:pikabu
```

The normal `pnpm build` remains the default/Yandex-compatible build.

## Local Edge Function environment

For local function work, use `supabase/functions/.env.local` for custom secrets. The file is git-ignored.

```text
PIKABU_GAME_SECRET=<local-or-test-secret>
CASCADE_ALLOWED_ORIGINS=http://localhost:5173
```

Start the local Supabase stack first when database access is required, then serve the function with the repository script:

```bash
pnpm supabase:serve -- --env-file supabase/functions/.env.local
```

The local Supabase runtime supplies its own database URL and service-role values. Never commit the local secret file.

## Database verification

With Docker/local Supabase available:

```bash
pnpm supabase:test
```

This executes the pgTAP contract in `supabase/tests/cascade_backend.sql`. The schema uses RLS and exposes no direct `anon`/`authenticated` table access; the browser talks only to the Edge Function.

## Two-browser-profile smoke test

Before release, test with two isolated browser profiles using the same Pikabu account:

1. In profile A, start as guest, win Standard, complete a Daily, reload, and verify local progress remains.
2. Verify guest leaderboard top rows can be read while no player result is created for the guest.
3. Authorize profile A and verify local progress remains after the local/cloud merge.
4. Open profile B, authorize the same Pikabu account, and verify cloud progress loads.
5. Starting from the same cloud revision, make one new win independently on A and B. Reconnect/sync both and verify both deltas exist exactly once.
6. Finish the first Daily attempt offline, replay locally, reconnect, and verify the official backend result is still the first frozen attempt.
7. Block the Supabase endpoint and verify startup, Standard, Daily, Mastery, and local persistence still work. Restore connectivity and verify pending profile/leaderboard operations flush.
8. Run a Yandex smoke test afterwards; Yandex storage and Yandex leaderboard APIs must behave exactly as before.

## Secret rotation

`PIKABU_GAME_SECRET` is used only by the Edge Function to verify `getSignedData()` tokens. Rotating it does not require putting a new secret into the browser bundle. Set the new Supabase secret and redeploy/restart the function as needed. Existing signed assertions created with the old secret may fail until the client obtains a fresh assertion; the game remains local-first while backend auth is unavailable.

## Logs and incident debugging

Use Supabase function logs to inspect status codes, route names, timing, and internal error identifiers. Never log:

- `Authorization` headers;
- Pikabu signed JWTs;
- `PIKABU_GAME_SECRET`;
- service-role credentials;
- complete profile payloads unless a deliberately redacted diagnostic build is used.

For auth failures, log only a generic reason/category and request correlation id. The token itself must never appear in logs.
