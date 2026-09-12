// Deterministic vector compositions of the actual game assets. No screenshot crops.
// Run with: node scripts/generate-rules-artwork.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getTheme } from '../src/theme/ThemeRegistry.ts';
import { createSlotFrameSvg, createSlotGlyphSvg } from '../src/theme/SlotArtwork.ts';

const theme = getTheme('walnut_study');
const root = new URL('../public/', import.meta.url);
const width = 1200;
const height = 600;
const cardWidth = 186;
const cardHeight = 260;
const data = path => `data:image/webp;base64,${readFileSync(new URL(path, root)).toString('base64')}`;
const vector = svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const back = data(theme.cardBack.url);
const surface = data(theme.boardSurface.url);
const frame = vector(createSlotFrameSvg(theme.slots.palette));
const images = new Map();
const picture = (href, x, y, w = cardWidth, h = cardHeight, attrs = '') => {
  if (!images.has(href)) images.set(href, `art-${images.size}`);
  return `<use href="#${images.get(href)}" x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;
};
const card = (name, x, y) => picture(data(`assets/cards/${name}.webp`), x, y, cardWidth, cardHeight, 'filter="url(#shadow)"');
const stock = (x, y) => [8, 4, 0].map(offset => picture(back, x, y + offset)).join('');
const slot = (x, y, role = 'tableau') => picture(frame, x, y)
  + (role === 'tableau' ? '' : picture(vector(createSlotGlyphSvg(role, theme.slots.palette)), x, y));
const stack = (names, x, y) => names.map((name, index) => card(name, x, y + index * 48)).join('');
const move = path => `<path d="${path}" fill="none" stroke="#ffe0a0" stroke-width="7" stroke-linecap="round" marker-end="url(#tip)" filter="url(#shadow)"/>`;
const ring = (x, y) => `<circle cx="${x}" cy="${y}" r="28" fill="#ffe0a0" fill-opacity=".18" stroke="#ffe0a0" stroke-width="5"/><circle cx="${x}" cy="${y}" r="8" fill="#ffe0a0"/>`;
const complete = body => {
  const background = picture(surface, 0, 0, width, height);
  const used = new Set([...`${body}${background}`.matchAll(/href="#(art-\d+)"/g)].map(match => match[1]));
  const assets = [...images].filter(([, id]) => used.has(id)).map(([href, id]) =>
    `<symbol id="${id}" viewBox="0 0 1 1" preserveAspectRatio="none"><image href="${href}" width="1" height="1" preserveAspectRatio="none"/></symbol>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  ${assets}
  <filter id="shadow" filterUnits="userSpaceOnUse" x="-50" y="-50" width="1300" height="700"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#160d07" flood-opacity=".42"/></filter>
  <marker id="tip" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="3.5" markerHeight="3.5" orient="auto-start-reverse"><path d="M2 2 10 6 2 10" fill="none" stroke="#ffe0a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker>
</defs>
${background}
<rect width="1200" height="600" fill="#20140b" fill-opacity=".22"/>
<rect x="40" y="45" width="510" height="510" rx="20" fill="#21160f" fill-opacity=".3" stroke="#dfbc7f" stroke-opacity=".25" stroke-width="2"/>
<rect x="650" y="45" width="510" height="510" rx="20" fill="#21160f" fill-opacity=".3" stroke="#dfbc7f" stroke-opacity=".25" stroke-width="2"/>
${move('M574 300 H626')}
${body}
</svg>\n`;
};

const scenes = {
  foundation: card('clubAce', 95, 225) + card('club2', 350, 225)
    + move('M426 192 Q295 74 173 192')
    + stack(['clubAce', 'club2'], 827, 200),
  'stock-draw-three': stock(202, 175) + ring(295, 295)
    + stock(680, 195)
    + card('heart2', 886, 195) + card('spade8', 926, 195) + card('club6', 966, 195),
  'empty-column': slot(95, 180) + stack(['club9', 'heart8', 'club7'], 350, 180)
    + move('M426 148 Q295 50 173 148')
    + stack(['club9', 'heart8', 'club7'], 695, 180) + slot(950, 180),
  'free-stock-cell': slot(95, 200, 'stock') + card('heartQueen', 350, 200)
    + move('M426 168 Q295 65 173 168')
    + card('heartQueen', 695, 200) + slot(950, 200),
  'alternating-colors': card('club9', 95, 200) + card('heart8', 350, 200)
    + move('M426 168 Q295 65 173 168')
    + stack(['club9', 'heart8'], 827, 180),
};

mkdirSync(new URL('assets/rules/', root), { recursive: true });
for (const [name, body] of Object.entries(scenes)) {
  const artwork = complete(body);
  writeFileSync(new URL(`assets/rules/${name}.svg`, root), artwork);
  console.log(`${name}.svg: ${width}×${height}, ${Math.round(Buffer.byteLength(artwork) / 1024)} KiB`);
}
