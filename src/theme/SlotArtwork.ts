import type { SlotPalette } from './ThemeDefinition.ts';
import type { Suit } from '../game/model/types.ts';

export type SlotRole = Suit | 'stock' | 'tableau';

// Normalized vector paths avoid font-dependent suit shapes on different devices.
const SUIT_PATHS: Readonly<Record<Suit, string>> = {
  clubs: 'M0 -22 C-15 -22 -19 -7 -9 0 C-27 -8 -31 16 -17 20 C-9 23 -4 17 -2 12 C-3 23 -7 27 -11 30 H11 C7 27 3 23 2 12 C4 17 9 23 17 20 C31 16 27 -8 9 0 C19 -7 15 -22 0 -22 Z',
  diamonds: 'M0 -30 L21 0 L0 30 L-21 0 Z',
  hearts: 'M0 26 C-5 18 -27 3 -25 -12 C-23 -29 -5 -29 0 -16 C5 -29 23 -29 25 -12 C27 3 5 18 0 26 Z',
  spades: 'M0 -29 C-7 -18 -26 -6 -25 7 C-24 23 -7 25 -2 12 C-3 23 -7 27 -11 30 H11 C7 27 3 23 2 12 C7 25 24 23 25 7 C26 -6 7 -18 0 -29 Z',
};

export function createSlotSvg(role: SlotRole, palette: SlotPalette): string {
  const color = role === 'hearts' || role === 'diamonds' ? palette.redSuit : palette.blackSuit;
  const glyph = role === 'tableau' ? '' : role === 'stock'
    ? `<g fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="88" y="103" width="40" height="54" rx="4"/><path d="M108 171v28m-11-11 11 11 11-11"/></g>`
    : `<path d="${SUIT_PATHS[role]}" transform="translate(108 151)" fill="${color}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="432" height="604" viewBox="0 0 216 302">
<defs>
  <linearGradient id="well" x2="0" y2="1"><stop stop-color="${palette.recess}" stop-opacity=".34"/><stop offset="1" stop-color="${palette.recess}" stop-opacity=".17"/></linearGradient>
  <linearGradient id="edge" x2="0" y2="1"><stop stop-color="${palette.edge}" stop-opacity=".62"/><stop offset=".5" stop-color="${palette.edge}" stop-opacity=".3"/><stop offset="1" stop-color="${palette.highlight}" stop-opacity=".52"/></linearGradient>
</defs>
<rect x="1.5" y="1.5" width="213" height="299" rx="9" fill="url(#well)" stroke="url(#edge)" stroke-width="2.2"/>
<path d="M10 5H206Q211 5 211 10V290" fill="none" stroke="${palette.recess}" stroke-opacity=".4" stroke-width="2"/>
<rect x="7" y="7" width="202" height="288" rx="5" fill="none" stroke="${palette.edge}" stroke-opacity=".13" stroke-width=".8"/>
<g opacity=".78">${glyph}</g>
</svg>`;
}
