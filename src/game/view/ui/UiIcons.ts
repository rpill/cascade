export type UiIconName =
  | 'undo'
  | 'restart'
  | 'new-deal'
  | 'home'
  | 'rules'
  | 'settings'
  | 'back'
  | 'spade'
  | 'heart'
  | 'crown'
  | 'calendar'
  | 'trophy';

const NS = 'http://www.w3.org/2000/svg';

function path(d: string): SVGPathElement {
  const element = document.createElementNS(NS, 'path');
  element.setAttribute('d', d);
  element.setAttribute('fill', 'none');
  element.setAttribute('stroke', 'currentColor');
  element.setAttribute('stroke-width', '1.75');
  element.setAttribute('stroke-linecap', 'round');
  element.setAttribute('stroke-linejoin', 'round');
  return element;
}


function strongPath(d: string): SVGPathElement {
  const element = path(d);
  element.setAttribute('stroke-width', '2.2');
  return element;
}

function filledPath(d: string): SVGPathElement {
  const element = document.createElementNS(NS, 'path');
  element.setAttribute('d', d);
  element.setAttribute('fill', 'currentColor');
  return element;
}
export function createUiIcon(name: UiIconName): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.dataset.icon = name;

  if (name === 'home') {
    svg.append(
      path('M4 11.5 12 5l8 6.5'),
      path('M6.5 10.5V20h11v-9.5'),
      path('M10 20v-5h4v5'),
    );
  } else if (name === 'undo') {
    svg.append(
      path('M9 7 4 12l5 5'),
      path('M5 12h8a6 6 0 0 1 6 6'),
    );
  } else if (name === 'restart') {
    svg.append(
      path('M19 8V4l-3 3'),
      path('M19 5a8 8 0 1 0 1 10'),
    );
  } else if (name === 'new-deal') {
    const backCard = path('M7 5h7.5A1.5 1.5 0 0 1 16 6.5V16a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 16V6.5A1.5 1.5 0 0 1 7 5Z');
    backCard.dataset.card = 'true';
    backCard.setAttribute('transform', 'rotate(-12 10.75 11.25)');

    const frontCard = path('M9.5 4.5H17A1.5 1.5 0 0 1 18.5 6v9.5A1.5 1.5 0 0 1 17 17H9.5A1.5 1.5 0 0 1 8 15.5V6A1.5 1.5 0 0 1 9.5 4.5Z');
    frontCard.dataset.card = 'true';

    const cardMark = path('M13.2 7.1 14.4 8.3 13.2 9.5 12 8.3Z');
    cardMark.dataset.cardMark = 'true';

    const plus = path('M15.5 19h6M18.5 16v6');
    plus.dataset.plus = 'true';
    svg.append(backCard, frontCard, cardMark, plus);
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
  } else if (name === 'spade') {
    svg.append(
      filledPath('M12 2.8C10.4 5.7 5 8.8 5 13.2a4.1 4.1 0 0 0 7 2.9c-.25 2.15-.9 3.7-2.15 5.1h4.3c-1.25-1.4-1.9-2.95-2.15-5.1a4.1 4.1 0 0 0 7-2.9C19 8.8 13.6 5.7 12 2.8Z'),
    );
  } else if (name === 'heart') {
    svg.append(
      filledPath('M12 20.6S4.2 15.4 4.2 9.5c0-3.2 2.1-5.4 5-5.4 1.45 0 2.55.7 2.8 1.7.25-1 1.35-1.7 2.8-1.7 2.9 0 5 2.2 5 5.4 0 5.9-7.8 11.1-7.8 11.1Z'),
    );
  } else if (name === 'crown') {
    svg.append(
      filledPath('M4.1 7.2 8.45 10.45 12 4.1l3.55 6.35L19.9 7.2l-1.65 9.6H5.75L4.1 7.2Zm2.05 11h11.7v1.7H6.15v-1.7Z'),
      filledPath('M3.8 6.2a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm8.2-2.1a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm8.2 2.1a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z'),
    );
  } else if (name === 'calendar') {
    svg.append(
      strongPath('M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Z'),
      strongPath('M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17'),
      filledPath('M7 12.5h4v4H7z'),
    );
  } else if (name === 'trophy') {
    svg.append(
      strongPath('M8 4h8v4.5c0 3.2-1.65 5.2-4 5.2s-4-2-4-5.2Z'),
      strongPath('M8 6H4.5v1.8A4.2 4.2 0 0 0 8.4 12M16 6h3.5v1.8a4.2 4.2 0 0 1-3.9 4.2'),
      strongPath('M12 13.8V18M8.5 20h7M10 18h4'),
    );
  } else {
    svg.append(
      path('M19 12H5'),
      path('m10 18-6-6 6-6'),
    );
  }

  return svg;
}
