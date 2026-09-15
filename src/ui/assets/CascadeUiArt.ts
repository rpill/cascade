export const CASCADE_UI_ART_KEYS = {
  homeBackdrop: 'cascade.ui.home.backdrop',
  homeHero: 'cascade.ui.home.hero',
  paperPanel: 'cascade.ui.paper.panel',
  material: 'cascade.ui.material',
  grain: 'cascade.ui.table.grain',
  paperGrain: 'cascade.ui.paper.grain',
  calendar: 'cascade.ui.art.calendar',
  themeFan: 'cascade.ui.art.theme-fan',
  rank: {
    novice: 'cascade.ui.rank.novice',
    player: 'cascade.ui.rank.player',
    tactician: 'cascade.ui.rank.tactician',
    expert: 'cascade.ui.rank.expert',
    master: 'cascade.ui.rank.master',
    grandmaster: 'cascade.ui.rank.grandmaster',
  },
} as const;

export const CASCADE_UI_ART_FILES = {
  // Phase 1 uses the proven Trifold composition assets behind semantic Cascade keys.
  // Final European/botanical art can replace these files without touching layout code.
  homeBackdrop: './assets/ui/art/jade-landscape.webp',
  homeHero: './assets/ui/art/paper-landscape.webp',
  paperPanel: './assets/ui/art/paper-landscape.webp',
  material: './assets/ui/art/material.webp',
  grain: './assets/ui/art/table-grain.webp',
  paperGrain: './assets/ui/art/paper-grain.webp',
  calendar: './assets/ui/art/daily-calendar.svg',
  themeFan: './assets/ui/art/theme-fan.svg',
  rank: {
    novice: './assets/ui/art/rank-novice.svg',
    player: './assets/ui/art/rank-player.svg',
    tactician: './assets/ui/art/rank-tactician.svg',
    expert: './assets/ui/art/rank-expert.svg',
    master: './assets/ui/art/rank-master.svg',
    grandmaster: './assets/ui/art/rank-grandmaster.svg',
  },
} as const;
