# Burgundy reference theme

Starting checkpoint: 6a0d89f. Preserve imported concepts and the approved floral card-back art. Finish Burgundy before expanding the theme catalog.

- [x] Separate each placeholder into one reusable full-card frame and an independent suit/stock icon. Use the requested card + downward arrow + tray shape for every theme. Theme palettes remain independent of geometry.
- [x] Keep the stock placeholder present. Match the visible back contour to the exact face-card dimensions by excluding transparent export padding. Render lower stock layers as plain paper edges, not repeated ornamental card backs.
- [x] Add a nine-region surface renderer for authored scenes: uniform corner scaling, straight edge strips, quiet material center. Keep the top and bottom border visible and corner props proportional across landscape sizes.
- [x] Recolor Burgundy to muted oxblood using ImageGen, preserve top-down props and card-back ornament, document original source dimensions and runtime geometry.
- [x] Verify layered slots, occupancy, texture bundles, surface geometry, stock draw/undo, theme switching and desktop/compact rendering. Replace contradictory imported preview tests with focused regression coverage; keep unregistered comparison concepts as drafts.
- [x] Document the reference contract in THEMES.md and THEME_FACTORY.md; provide actual gameplay screenshots and a separate result commit.

Scope: cosmetic infrastructure and Burgundy. No game-rule, viewport-layout, card-face, shop/economy or menu changes. The user's latest instruction allows the thin background inlay for this scene; it must be visible symmetrically at top/bottom.
