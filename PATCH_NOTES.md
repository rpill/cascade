# HiDPI mobile geometry hotfix

Apply this patch **after** `cascade_hidpi_mobile_fix_patch.zip` (and the startup reliability patch already used by that build).

The previous HiDPI patch correctly increased the backing-store resolution, but camera zoom also scaled the Phaser world and shifted the board into the upper-left part of the mobile viewport.

This hotfix keeps the 2x HiDPI backing store but:

- restores the Phaser camera to `zoom = 1`;
- calculates the responsive layout from the original CSS/logical viewport;
- scales only board geometry into backing-store coordinates;
- preserves the same compact-landscape breakpoint/profile;
- preserves Phaser's CSS-to-canvas pointer mapping.

No asset or WebP files are changed.
