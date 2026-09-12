# Tutorial illustrations

All five SVG illustrations use a 1200 × 600 canvas and the same 186 × 260 card
geometry. Each shows the starting state on the left and the result on the right.
Movement arrows and the stock tap indicator are vector paths; there is no
language-specific text or mouse cursor in the artwork.

The illustrations reuse the current Walnut Study surface, card back, slot artwork,
and shared Vintage card faces. Raster images are embedded once per SVG so the
illustrations also work when loaded through HTML `<img>` without external SVG
resource requests. Existing asset provenance in `THIRD_PARTY_ASSETS.md` applies.

Regenerate from the repository root after changing the source art:

```sh
node scripts/generate-rules-artwork.mjs
```

`RulesSlides.ts` records the same intrinsic size for every image. The dialog
reserves consistent caption and footer rows so neither longer copy nor the final
“Got it” button resizes the image during navigation.
