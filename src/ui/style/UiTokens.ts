export const UI_TOKENS = {
  color: {
    table: 0x082f27,
    control: 0x123d32,
    controlActive: 0x24584d,
    paper: 0xf7ecd6,
    paperPressed: 0xd9c7a8,
    ink: 0x1b2e29,
    mutedInk: 0x68746d,
    gold: 0xbc9756,
    goldLight: 0xe4c78a,
    danger: 0xb86262,
    overlay: 0x0d1f1e,
  },
  radius: { card: 16, panel: 20, control: 12 },
  stroke: { thin: 1, normal: 2 },
  spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
  asset: {
    homeBackground: 'ui.home.background',
    paperPanel: 'ui.panel.paper',
    coinIcon: 'ui.icon.coin',
  },
} as const;
