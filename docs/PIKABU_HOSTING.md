# Pikabu static hosting contract

## What is hosted

The Pikabu frontend is a static Vite application. Only the contents of `dist/` are deployed to the public static host.

The public deployment repository must contain built artifacts only. It must not contain:

- TypeScript source;
- tests or test fixtures;
- private repository history;
- Supabase migrations/function secrets;
- `.env.pikabu.local`;
- Pikabu game secret;
- Supabase service-role credentials.

The existing Vite configuration uses a relative `base: './'`, so static assets remain host-independent.

## Current hosting candidate

GitVerse Pages is the current candidate for the static frontend. It is a deployment choice, not a code dependency. The backend API contract, Supabase project, and Pikabu adapter do not depend on GitVerse-specific APIs.

**Release gate:** obtain written confirmation from GitVerse support that a monetized Pikabu game may use the chosen Pages Free plan before public release. Store that confirmation with release records. Until that written answer exists, hosting is not considered production-approved.

If commercial use is denied or the service becomes unsuitable, replace only the static host. Do not redesign cloud storage, auth verification, or the backend API for a hosting-provider change.

## Deployment flow

1. Configure `.env.pikabu.local` with public Pikabu build values.
2. Run `pnpm build:pikabu`.
3. Verify `dist/` contains no server secret names/values.
4. Publish only `dist/` to the static deployment repository/host.
5. Add the final HTTPS origin to `CASCADE_ALLOWED_ORIGINS` on the Supabase function.
6. Test the final hosted URL inside Pikabu Studio/test environment.

The Pikabu SDK is expected to be tested in the platform/test environment; a raw standalone URL is not sufficient evidence that SDK auth/lifecycle integration works correctly.

## Security check before upload

From the repository root:

```bash
! grep -R "PIKABU_GAME_SECRET\|SUPABASE_SERVICE_ROLE_KEY" dist
```

This check catches secret *names* accidentally bundled into frontend output. Also review the built environment values: `VITE_BACKEND_URL` is intentionally public, while all signing/database service credentials stay server-side.
