Cascade Pikabu -> Cloudflare Worker + D1 migration patch (v2)

This v2 excludes the already-created design/spec and implementation-plan documents.
It is safe to apply when these files already exist in your working tree:
  docs/superpowers/specs/2026-09-22-cloudflare-d1-pikabu-backend-design.md
  docs/superpowers/plans/2026-09-22-cloudflare-d1-pikabu-backend-plan.md

HOW TO APPLY
1. Delete/ignore the previous cascade-d1-patch folder, then extract this archive's
   "cascade-d1-patch" folder directly into the Cascade project root.

2. From the Cascade project root run:
     .\cascade-d1-patch\apply-d1-patch.cmd

The script runs "git apply --check" first. If the check fails, it changes nothing.
Do not force-apply a failed patch; send the error output back to ChatGPT.

The patch does NOT contain, read, delete, or modify server/yandex/.env.deploy.local.

AFTER APPLYING
Run these local verification commands before any Cloudflare/D1 deployment:
  pnpm test
  pnpm build
  pnpm build:pikabu
  pnpm backend:test
  pnpm backend:build:cloudflare

Do not run backend:setup:d1 until those checks are green.
