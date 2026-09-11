# WebP optimization notes

## Result

- `public/assets` before: 39,838,069 bytes (37.99 MiB)
- `public/assets` after: 14,508,367 bytes (13.84 MiB)
- Saved: 25,329,702 bytes (63.58%)
- Converted PNG payload: 31,793,821 bytes -> 6,464,150 bytes (79.67% smaller)
- Converted files: 92
- Existing WebP/JPG/SVG/OGG assets were not recompressed in this pass.

## Image guarantees checked

- Every converted WebP keeps the source width and height.
- 85 source images contained non-opaque alpha; decoded WebP alpha matched the PNG alpha pixel-for-pixel for all 85.
- Encoding: WebP quality 95, method 6, `exact=True`.
- Representative opaque/RGB PSNR values: home background 42.67 dB; rules screenshot 34.98 dB; heart king 31.19 dB; navy card back 30.34 dB. Alpha remained exact for these samples where present.

## Tests

Final full test run: 654 tests total, 644 passed, 8 failed, 2 skipped.
The same 8 failures are present in the pre-optimization analytics baseline and are unrelated existing visual/style tests:

- App shell binds material and frame roles instead of generated placeholder geometry
- home back-to-game button stays high-contrast on the generated wood background
- home footer panels reuse the same paper tone family as the main home cards
- phone navigation tabs use larger text in both mobile responsive stylesheets
- home background uses the real table surface and does not render decorative card props
- Home wallet balance and add action render as one continuous capsule
- Statistics summary keeps one vertical column of metric tiles while both large panels stay equal height
- hybrid shell separates the wood brand header from the parchment content surface without fake card props

The new WebP regression and focused card/theme/rules/home asset tests pass.

## Build verification limitation in this environment

`npm run build` cannot complete here because this snapshot has no installed Node dev dependencies / Node typings. Running the same build on the pre-optimization baseline fails for the same missing `node:*` type declarations and pre-existing strict test errors, so this is not introduced by the WebP migration.

## Applying the patch

After extracting the patch over the project, run once:

```bash
node scripts/apply-webp-migration.mjs
```

The script removes only `.png` files that have a same-name `.webp` sibling. This is required because extracting a ZIP cannot delete the old PNG files by itself; leaving them in `public/assets` would make Vite package both formats and would defeat the size reduction.
