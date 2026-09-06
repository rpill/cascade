export type HomeArtIconName =
  | 'spade'
  | 'heart'
  | 'crown'
  | 'calendar'
  | 'trophy'
  | 'rules'
  | 'settings';

const ICON_ASSETS: Readonly<Record<HomeArtIconName, string>> = {
  spade: './assets/ui/icons/spade.svg',
  heart: './assets/ui/icons/heart.svg',
  crown: './assets/ui/icons/crown.svg',
  calendar: './assets/ui/icons/calendar.svg',
  trophy: './assets/ui/icons/trophy.svg',
  rules: './assets/ui/icons/question.svg',
  settings: './assets/ui/icons/gear.svg',
};

function resolveAssetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

export function createHomeArtIcon(name: HomeArtIconName): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.className = `home-art-icon home-art-icon-${name}`;
  icon.dataset.homeArtIcon = name;
  icon.setAttribute('aria-hidden', 'true');
  icon.style.setProperty('--home-art-icon', `url("${resolveAssetUrl(ICON_ASSETS[name])}")`);
  return icon;
}
