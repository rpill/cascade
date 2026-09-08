export type UiIconName =
  | 'undo'
  | 'restart'
  | 'new-deal'
  | 'home'
  | 'rules'
  | 'settings'
  | 'back';

type GameplayIconName = Extract<UiIconName, 'undo' | 'restart' | 'new-deal' | 'home'>;

const NS = 'http://www.w3.org/2000/svg';

// Tabler Icons v3.46.0, outline style, MIT license.
// Selected gameplay set:
// undo -> arrow-back-up, restart -> refresh, new-deal -> cards, home -> home.
const TABLER_GAMEPLAY_ICONS: Readonly<Record<GameplayIconName, readonly string[]>> = {
  undo: [
    'M9 13l-4 -4l4 -4m-4 4h11a4 4 0 0 1 0 8h-1',
  ],
  restart: [
    'M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4',
    'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4',
  ],
  'new-deal': [
    'M3.604 7.197l7.138 -3.109a.96 .96 0 0 1 1.27 .527l4.924 11.902a1 1 0 0 1 -.514 1.304l-7.137 3.109a.96 .96 0 0 1 -1.271 -.527l-4.924 -11.903a1 1 0 0 1 .514 -1.304l0 .001',
    'M15 4h1a1 1 0 0 1 1 1v3.5',
    'M20 6c.264 .112 .52 .217 .768 .315a1 1 0 0 1 .53 1.311l-2.298 5.374',
  ],
  home: [
    'M5 12l-2 0l9 -9l9 9l-2 0',
    'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7',
    'M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
  ],
};

function path(d: string, strokeWidth = '1.8'): SVGPathElement {
  const element = document.createElementNS(NS, 'path');
  element.setAttribute('d', d);
  element.setAttribute('fill', 'none');
  element.setAttribute('stroke', 'currentColor');
  element.setAttribute('stroke-width', strokeWidth);
  element.setAttribute('stroke-linecap', 'round');
  element.setAttribute('stroke-linejoin', 'round');
  return element;
}

function isGameplayIconName(name: UiIconName): name is GameplayIconName {
  return name === 'undo' || name === 'restart' || name === 'new-deal' || name === 'home';
}

export function createUiIcon(name: UiIconName): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.dataset.icon = name;

  if (isGameplayIconName(name)) {
    svg.dataset.iconSet = 'tabler';
    svg.append(...TABLER_GAMEPLAY_ICONS[name].map((d) => path(d, '2')));
  } else if (name === 'rules') {
    svg.append(
      path('M9.5 9a2.7 2.7 0 1 1 4.6 1.9c-1.4 1-2.1 1.6-2.1 3'),
      path('M12 18h.01'),
      path('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z'),
    );
  } else if (name === 'settings') {
    svg.append(
      path('M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z'),
      path('M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.5 1a7 7 0 0 0-1.7-1L14.3 3h-4.6L9.3 6a7 7 0 0 0-1.7 1L5.1 6 3 9.4 5.1 11a7 7 0 0 0 0 2L3 14.6 5.1 18l2.5-1a7 7 0 0 0 1.7 1l.4 3h4.6l.4-3a7 7 0 0 0 1.7-1l2.5 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z'),
    );
  } else {
    svg.append(
      path('M19 12H5'),
      path('m10 18-6-6 6-6'),
    );
  }

  return svg;
}
