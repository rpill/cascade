export const UI_TOKENS = {
  color: {
    table: 0x0a2922,
    control: 0x153e34,
    controlActive: 0x205346,
    paper: 0xf7efdc,
    paperPressed: 0xd9c7a8,
    ink: 0x1b2e29,
    mutedInk: 0x68746d,
    gold: 0xb69557,
    goldLight: 0xe6cc91,
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
