# Burgundy Club

Reference implementation, 2026-09-08. Runtime definition: src/theme/ThemeRegistry.ts.

- board-surface-refined.webp: ImageGen edit of the user-supplied board-surface.webp. Muted wine cloth, strictly overhead scene, quiet upper-right controls area. Output 1672 × 941, encoded as WebP quality 90. Runtime uses 1672 × 922: trimming the bottom 19 pixels balances the outer gold rails at approximately 29 pixels from both edges. Nine-region rendering preserves the full border and corner proportions.
- card-back.webp: corrected club ornament normalized to 432 × 604 with the shared rounded transparent contour preserved, then encoded as WebP quality 95. Runtime uses the full image with no crop frame.
- shop-card-back.webp: corrected 165 × 230 preview using the same rounded transparent contour.
- Slot frames and glyphs are separate generated SVG layers. The stock placeholder stays present. Lower stock cards use shared plain paper edges.
- Original board-surface.webp and other imported files are retained as source material, not loaded by this theme.
