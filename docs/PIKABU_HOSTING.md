# Pikabu static hosting contract

The Pikabu frontend is a static Vite build. Only `dist/` is published to the static host. The public bundle must not contain TypeScript source, tests, repository history, local env files, or server secrets.

GitVerse Pages remains the static host. Persistence is independent of GitVerse: the frontend talks to a Cloudflare Worker and authorized Pikabu cloud state lives in D1 database `cascade-db`.

## Deployment flow

1. Provision/migrate D1 with `pnpm backend:setup:d1`.
2. Run `pnpm backend:build:cloudflare` and `pnpm backend:deploy:cloudflare`.
3. Smoke the Worker using `https://games.pikabu.ru` as the allowed origin.
4. Set repository variable `PIKABU_BACKEND_URL` to the deployed `workers.dev` URL.
5. Run `pnpm build:pikabu` locally when verifying the release artifact.
6. Trigger the existing `pikabu-*` tag workflow; it publishes only `dist/` to GitVerse.
7. Test the hosted build inside the Pikabu test environment.

The Pikabu SDK must be validated inside the real platform/test environment; the raw GitVerse URL alone is not sufficient evidence for auth/lifecycle behavior.

## Security check

The browser artifact must contain the public Worker URL but must not contain server secret names or any legacy third-party provisioning/login code. Use `tests/pikabu-no-gamepush-artifact.test.mjs` after the final Pikabu build.

Repeated Cloudflare Worker error `1102` during real authenticated traffic blocks release. Do not enable a paid plan automatically.
