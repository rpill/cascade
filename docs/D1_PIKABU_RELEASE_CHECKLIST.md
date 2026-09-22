# Pikabu + Cloudflare D1 release checklist

## Local/build gates

- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm build:pikabu`
- [ ] `pnpm backend:test`
- [ ] `pnpm backend:build:cloudflare`
- [ ] Browser artifact guard passes and contains the configured Worker URL.

Final Pikabu artifact check:

```powershell
$env:VITE_PLATFORM_TARGET='pikabu'
$env:VITE_BACKEND_URL='https://cascade-api.rpill-games.workers.dev'
pnpm build:pikabu
node --test tests/pikabu-no-gamepush-artifact.test.mjs
```

## Cloudflare setup/deploy

Run in order:

```powershell
pnpm dlx wrangler@4.135.0 login
pnpm dlx wrangler@4.135.0 secret put PIKABU_GAME_SECRET
pnpm dlx wrangler@4.135.0 secret put BRIDGE_SESSION_SECRET
pnpm backend:setup:d1
pnpm backend:deploy:cloudflare
$env:CLOUDFLARE_BACKEND_URL='https://cascade-api.rpill-games.workers.dev'
$env:CLOUDFLARE_SMOKE_ORIGIN='https://games.pikabu.ru'
pnpm backend:smoke:cloudflare
```

Expected setup state: D1 database `cascade-db`, binding `DB`, migrations applied, no secret values printed. The Worker runs on `workers.dev`.

## Real Pikabu acceptance

- [ ] Guest can open the game, play, save locally, and reload without backend auth.
- [ ] Pikabu authorization is the only account/auth UI shown.
- [ ] Network shows no legacy third-party SDK/login script or code-login modal.
- [ ] First authorized `POST /v1/session` returns 200 directly.
- [ ] Cloud profile survives reload.
- [ ] The same Pikabu account in a second browser/profile receives the same D1 cloud state.
- [ ] Standard leaderboard read/submission works.
- [ ] Daily leaderboard read/submission works.
- [ ] Daily Streak leaderboard read/submission works.
- [ ] Mastery leaderboard read/submission works.
- [ ] Replaying an already accepted Daily cannot replace its first D1 result.
- [ ] Blocking the Worker still leaves gameplay/local save functional; queued work retries when the Worker is restored.
- [ ] Worker logs/observability show no repeated error `1102` under authenticated profile/leaderboard traffic.

Repeated `1102` is a release blocker. Do not automatically switch to Workers Paid. Free-limit exhaustion is treated as backend unavailability; the local-first game remains playable.
