import * as Phaser from 'phaser';
import { CASCADE_UI_ART_FILES, CASCADE_UI_ART_KEYS } from './CascadeUiArt.ts';

const ICON_ROOT = './assets/ui/icons';

export const UI_ART_KEYS = {
  jade: CASCADE_UI_ART_KEYS.homeBackdrop,
  paper: CASCADE_UI_ART_KEYS.paperPanel,
  material: CASCADE_UI_ART_KEYS.material,
  grain: CASCADE_UI_ART_KEYS.grain,
  paperGrain: CASCADE_UI_ART_KEYS.paperGrain,
} as const;

export const UI_ICON_KEYS = {
  home: 'ui.icon.home', newDeal: 'ui.icon.new-deal', restart: 'ui.icon.restart', undo: 'ui.icon.undo', hint: 'ui.icon.hint',
  settings: 'ui.icon.settings', back: 'ui.icon.back', close: 'ui.icon.close', leaderboard: 'ui.icon.leaderboard',
  howToPlay: 'ui.icon.how-to-play', daily: 'ui.icon.daily', archive: 'ui.icon.archive', history: 'ui.icon.history',
  mastery: 'ui.icon.mastery', laurel: 'ui.icon.laurel',
  streak: 'ui.icon.streak', soundOn: 'ui.icon.sound-on', soundOff: 'ui.icon.sound-off', music: 'ui.icon.music',
  profile: 'ui.icon.profile', check: 'ui.icon.check',
  fire: 'ui.icon.fire', trophy: 'ui.icon.trophy', crown: 'ui.icon.crown',
  lock: 'ui.icon.lock', info: 'ui.icon.info', more: 'ui.icon.more', chevronLeft: 'ui.icon.chevron-left',
  chevronRight: 'ui.icon.chevron-right', chevronUp: 'ui.icon.chevron-up', chevronDown: 'ui.icon.chevron-down',
} as const;

const UI_ICON_FILES: Readonly<Record<keyof typeof UI_ICON_KEYS, string>> = {
  home:'home.svg',newDeal:'new-deal.svg',restart:'restart.svg',undo:'undo.svg',hint:'hint.svg',settings:'settings.svg',back:'back.svg',close:'close.svg',
  leaderboard:'leaderboard.svg',howToPlay:'how-to-play.svg',daily:'daily.svg',archive:'archive.svg',history:'history.svg',
  mastery:'mastery.svg',laurel:'laurel.svg',streak:'streak.svg',soundOn:'sound-on.svg',soundOff:'sound-off.svg',music:'music.svg',
  profile:'profile.svg',check:'check.svg',fire:'fire.svg',trophy:'trophy.svg',crown:'crown.svg',lock:'lock.svg',info:'info.svg',more:'more.svg',
  chevronLeft:'chevron-left.svg',chevronRight:'chevron-right.svg',chevronUp:'chevron-up.svg',chevronDown:'chevron-down.svg',
};

export function preloadUiAssets(scene: Phaser.Scene): void {
  for (const rank of Object.keys(CASCADE_UI_ART_FILES.rank) as (keyof typeof CASCADE_UI_ART_FILES.rank)[]) {
    const key = CASCADE_UI_ART_KEYS.rank[rank];
    if (!scene.textures.exists(key)) scene.load.svg(key, CASCADE_UI_ART_FILES.rank[rank], { width: 384, height: 384 });
  }
  for (const rank of Object.keys(CASCADE_UI_ART_FILES.rankLeaderboard) as (keyof typeof CASCADE_UI_ART_FILES.rankLeaderboard)[]) {
    const key = CASCADE_UI_ART_KEYS.rankLeaderboard[rank];
    if (!scene.textures.exists(key)) scene.load.image(key, CASCADE_UI_ART_FILES.rankLeaderboard[rank]);
  }
  if (!scene.textures.exists(CASCADE_UI_ART_KEYS.calendar)) scene.load.image(CASCADE_UI_ART_KEYS.calendar, CASCADE_UI_ART_FILES.calendar);
  const raster = [
    [CASCADE_UI_ART_KEYS.homeBackdrop, CASCADE_UI_ART_FILES.homeBackdrop],
    [CASCADE_UI_ART_KEYS.homeHero, CASCADE_UI_ART_FILES.homeHero],
    [CASCADE_UI_ART_KEYS.homeDaily, CASCADE_UI_ART_FILES.homeDaily],
    [CASCADE_UI_ART_KEYS.homeMastery, CASCADE_UI_ART_FILES.homeMastery],
    [CASCADE_UI_ART_KEYS.homeLeaders, CASCADE_UI_ART_FILES.homeLeaders],
    [CASCADE_UI_ART_KEYS.paperPanel, CASCADE_UI_ART_FILES.paperPanel],
    [CASCADE_UI_ART_KEYS.paperLandscape, CASCADE_UI_ART_FILES.paperLandscape],
    [CASCADE_UI_ART_KEYS.dailyPanelBg, CASCADE_UI_ART_FILES.dailyPanelBg],
    [CASCADE_UI_ART_KEYS.masteryPanelBg, CASCADE_UI_ART_FILES.masteryPanelBg],
    [CASCADE_UI_ART_KEYS.leaderboardPanelBg, CASCADE_UI_ART_FILES.leaderboardPanelBg],
    [CASCADE_UI_ART_KEYS.material, CASCADE_UI_ART_FILES.material],
    [CASCADE_UI_ART_KEYS.grain, CASCADE_UI_ART_FILES.grain],
    [CASCADE_UI_ART_KEYS.paperGrain, CASCADE_UI_ART_FILES.paperGrain],
  ] as const;
  for (const [key, url] of raster) if (!scene.textures.exists(key)) scene.load.image(key, url);
  for (const [name, key] of Object.entries(UI_ICON_KEYS) as [keyof typeof UI_ICON_KEYS, string][]) {
    if (!scene.textures.exists(key)) scene.load.svg(key, `${ICON_ROOT}/${UI_ICON_FILES[name]}`, { width: 64, height: 64 });
  }
}
