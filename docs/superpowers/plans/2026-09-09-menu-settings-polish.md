# Menu, catalog and settings implementation plan

Goal: Address user screenshots, support growing collections and add Russian/English settings with Yandex-aware defaults.

Design: Keep the board in Phaser and menus in DOM. Replace catalog pagination with an internally scrolling responsive grid; card width stays bounded even when the filter has one item. Give compact menus wider side gutters, balanced card spacing and always-visible seven-day indicators (neutral placeholders without trusted time). Show the next-level reward beside XP. Settings preserve manual language and sound preferences; first launch uses SDK language. Audio respects visibility/platform pause in addition to the user preference.

Ruling: The user's new scroll request supersedes old no-scroll catalog guidance. Other fixed overlays keep their established behavior. Work in current checkout preserving existing changes. No commits or publication requested.

Tasks:
- [x] Root: filter/grid catalog, bounded cards, scroll/focus retention; replace obsolete pagination tests.
- [x] Root: mobile shell spacing, daily placeholders, next-level motivation; verify screenshots including portrait and landscape.
- [x] Settings agent: preference/localization modules, settings modal, SDK defaults, audio mute integration, live localization across UI; independent behavior tests.
- [x] Root: browser tests for scroll with 12 items, one-owned-card sizing, purchase/equip/F5, settings switching and sound/lifecycle, responsive RU/EN.
- [x] Code review, full pnpm test/build, update current docs and Yandex acceptance notes.

Official references checked: https://yandex.ru/dev/games/doc/ru/concepts/requirements and https://yandex.ru/dev/games/doc/ru/requirements/2/14 . SDK language, mute control, sound pause on tab/ad interruption and usable responsive UI are in scope. Real platform acceptance remains separate from mocked SDK browser checks.

## Verification, 2026-09-10

- `pnpm test`: 414 passed, zero failures. `pnpm build`: passed; existing informational large-chunk warning remains.
- `menu-runtime.mjs`: passed at 1915×953, 1366×768, 844×390, 667×375, 740×320, 390×844 and 360×640. Includes seven Daily placeholders, next-level reward, single-item sizing, 12-item scrolling and destination scroll reset.
- `settings-runtime.mjs`: passed for SDK English, manual Russian/F5, actual Phaser mute after browser audio unlock, visibility/platform pause, live translations, modal return, board/Undo retention, narrow statistics/rules and English screenshots.
- `economy-runtime.mjs` and `economy-edgecases.mjs`: passed after changing pagination assertions to action reachability via scrolling; purchase/equip/F5 and storage retry guarantees remain covered.
- Partial independent review confirmed modal/language cleanup, then was interrupted by account usage limits. Root completed the check and fixed retention of replaced localized rows: bindings now retire disconnected nodes after each synchronous render, even without a later language switch.
- Screenshots and logs: ignored `artifacts/`. Development preview: http://127.0.0.1:5181/ . No commits or deployment performed.
