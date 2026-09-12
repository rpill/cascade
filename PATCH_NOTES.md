# Cascade UI visibility hotfix

Base intent: apply on top of the current project state after the active-deal continue patch.

Changes:
- Back-to-game / К игре button now uses a stronger wood-texture capsule with a warm gold border and inset/depth treatment on both desktop and mobile.
- Compact-landscape slot frame alpha changed from 1.00 to 0.78 so the table surface subtly shows through on phones.
- Desktop slot alpha remains unchanged: foundation/stock 0.48, tableau 0.30.
- Slot glyphs remain fully opaque.

Verification:
- New focused contracts: 11/11 PASS.
- Full test suite excluding localization.test.ts (requires unavailable local TypeScript package): 685 PASS / 0 FAIL / 2 SKIP.
