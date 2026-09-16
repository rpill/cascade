/** Authored intaglio collection. Run with Node; install sharp or use the Codex bundled runtime. */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let sharp;
try { sharp = createRequire(import.meta.url)('sharp'); }
catch { sharp = createRequire('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'); }
const root = fileURLToPath(new URL('../public/assets/', import.meta.url));
const themes = [
  { id: 'walnut-study', ink: '#103e34', light: '#25584b', gold: '#cbb273', motif: 'acanthus', board: '#113a31', wood: '#3b291e' },
  { id: 'navy-study', ink: '#152d4b', light: '#2e4a6b', gold: '#d4bd82', motif: 'compass', board: '#122b40' },
  { id: 'burgundy-club', ink: '#592332', light: '#793647', gold: '#d9b878', motif: 'heraldry', board: '#3f202a' },
  { id: 'autumn-evening', ink: '#673e26', light: '#875332', gold: '#e2b56b', motif: 'oak', board: '#3d2e23' },
  { id: 'winter-living-room', ink: '#24464a', light: '#365c60', gold: '#d2d4bf', motif: 'evergreen', board: '#20383c' },
  { id: 'spring-morning', ink: '#486045', light: '#637658', gold: '#e4d6a0', motif: 'floral', board: '#293e32' },
  { id: 'summer-veranda', ink: '#26544f', light: '#417269', gold: '#e5c878', motif: 'citrus', board: '#25413a' },
  { id: 'office', ink: '#303b40', light: '#49535a', gold: '#b8ad90', motif: 'geometric', board: '#252e32' },
  { id: 'retro-hotel', ink: '#1a5147', light: '#317163', gold: '#dfbe77', motif: 'deco', board: '#153c35' },
  { id: 'green-felt-club', ink: '#27583c', light: '#3f744d', gold: '#d5c78f', motif: 'laurel', board: '#244a37' },
];

const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
const leaf = `<path d="M0 0C-20-7-24-29-17-43C1-38 12-15 0 0Z" fill="currentColor" fill-opacity=".18"/><path d="M0 0Q-10-21-17-43"/>`;
function branch(count = 7) {
  return `<path d="M0 75Q-58 9-12-78"/>${repeat(count, i => {
    const y = 53 - i * 19; const x = -28 + Math.pow(i - 3, 2) * 2.3;
    return `<g transform="translate(${x} ${y}) rotate(${-50 + i * 10}) scale(.52)">${leaf}</g><g transform="translate(${x} ${y}) rotate(${105 + i * 10}) scale(.46)">${leaf}</g>`;
  })}`;
}
function rosette(r = 44, count = 12) {
  return repeat(count, i => `<ellipse cx="0" cy="${-r / 2}" rx="${r / 5}" ry="${r / 2}" transform="rotate(${i * 360 / count})"/>`) + `<circle r="${r * .17}"/>`;
}
function guilloche(phase) {
  return 'M' + Array.from({ length: 721 }, (_, i) => {
    const a = i * Math.PI / 360; const wave = Math.sin(a * 36 + phase) * 2.5;
    return `${(216 + (129.5 + wave) * Math.cos(a)).toFixed(2)},${(302 + (185.5 + wave) * Math.sin(a)).toFixed(2)}`;
  }).join('L') + 'Z';
}
function fleur() {
  return `<path d="M0-65C-22-42-26-23-5 12C-31-29-64-20-49 6C-44 17-31 16-29 5C-28-3-18 7-12 19H12C18 7 28-3 29 5C31 16 44 17 49 6C64-20 31-29 5 12C26-23 22-42 0-65ZM-19 22H19V30H-19ZM-8 31L-16 47L0 41L16 47L8 31"/>`;
}
function motif(t) {
  switch (t.motif) {
    case 'compass': return `<circle r="70"/><circle r="64"/><circle r="50"/>${repeat(32, i => `<path d="M0-64V-${i % 4 ? 58 : 53}" transform="rotate(${i * 11.25})"/>`)}${repeat(8, i => `<g transform="rotate(${i * 45})"><path d="M0-57L10-10L0 0Z" fill="${t.gold}"/><path d="M0-57L-10-10L0 0Z" fill="${t.ink}"/></g>`)}<circle r="8" fill="${t.ink}"/><circle r="3" fill="${t.gold}"/><path d="M-84-81l3-8 3 8 8 3-8 3-3 8-3-8-8-3ZM81 68l3-8 3 8 8 3-8 3-3 8-3-8-8-3"/>`;
    case 'heraldry': return `<path d="M-58-58Q0-75 58-58V5Q52 47 0 77Q-52 47-58 5Z"/><path d="M-49-51Q0-65 49-51V5Q40 44 0 66Q-40 44-49 5Z"/> <g transform="translate(0 0) scale(.67)">${fleur()}</g><path d="M-29-85L-38-105L-13-94L0-113L13-94L38-105L29-85Z"/><path d="M-29-79H29"/><g transform="translate(-67 12) scale(.6)">${branch()}</g><g transform="translate(67 12) scale(-.6 .6)">${branch()}</g>`;
    case 'oak': return `<path d="M0 86V-69M0 24L-35-12M0 2L36-34"/><path d="M0-81C-35-85-24-62-38-62C-66-65-54-35-63-32C-81-13-41-5-50 8C-66 28-28 49 0 58C28 49 66 28 50 8C41-5 81-13 63-32C54-35 66-65 38-62C24-62 35-85 0-81Z"/><g transform="translate(-48 65) rotate(35)"><path d="M-15 0Q0 43 15 0Z"/><path d="M-19 0Q0-23 19 0Z"/><path d="M-10-5L10 0M-4-10L15-4"/></g><g transform="translate(48 65) rotate(-35)"><path d="M-15 0Q0 43 15 0Z"/><path d="M-19 0Q0-23 19 0Z"/></g>`;
    case 'evergreen': return `<path d="M0-91V85"/>${repeat(8, i => { const y = -70 + i * 19; const s = 17 + i * 6; return `<path d="M0 ${y}L-${s} ${y + 32}M0 ${y}L${s} ${y + 32}"/>${repeat(5, j => `<path d="M${-s * j / 5} ${y + 32 * j / 5}l-10-2m${10 + s * j / 5 * 2} 2l10-2"/>`)}`; })}<g transform="translate(0 -119) scale(.33)">${rosette(35, 6)}</g>`;
    case 'floral': return `<path d="M0 90V-2M0 40Q-54 34-49-8Q-11 0 0 40M0 62Q54 48 49 13Q11 22 0 62"/><path d="M0 3C-48 1-60-51-35-76L-10-51L0-92L10-51L35-76C60-51 48 1 0 3Z"/><path d="M0 3Q-23-28-10-51M0 3Q23-28 10-51"/><g transform="translate(-58 64) scale(.5)">${rosette(24, 6)}</g><g transform="translate(57-29) scale(.5)">${rosette(24, 6)}</g>`;
    case 'citrus': return `<path d="M-52 49Q0 55 46-43M5 12Q-44-49-34-81Q18-76 27-18M26-18Q44-79 82-73Q84-27 26-18"/><path d="M-33-81L24-19M79-71L29-21"/><g transform="translate(-21 32) rotate(35)"><path d="M0-52C31-49 47-20 39 11C37 27 24 43 0 52C-24 43-37 27-39 11C-47-20-31-49 0-52Z"/><path d="M-25-27Q-44 2-17 31"/><path d="M-3-51L0-62L8-52"/></g>${repeat(8, i => `<circle cx="${i % 3 * 10 - 25}" cy="${Math.floor(i / 3) * 12 + 16}" r=".8" fill="${t.gold}"/>`)}`;
    case 'geometric': return repeat(5, i => `<path d="M0-${92 - i * 12}L${63 - i * 8} 0L0 ${92 - i * 12}L-${63 - i * 8} 0Z"/>`) + `<path d="M-83 0H83M0-106V106"/><circle r="15"/>`;
    case 'deco': return `<path d="M-70 70V-10L0-90L70-10V70Z"/><path d="M-59 65V-5L0-73L59-5V65Z"/>${repeat(9, i => { const a = (i * 20 - 80) * Math.PI / 180; return `<path d="M0 50L${Math.sin(a) * 61} ${50 - Math.cos(a) * 109}"/>`; })}<path d="M-77 76H77M-66 84H66M-51 92H51"/><circle cy="50" r="13" fill="${t.ink}"/><circle cy="50" r="7"/>`;
    case 'laurel': return `<g transform="translate(-34 0)">${branch(8)}</g><g transform="translate(34 0) scale(-1 1)">${branch(8)}</g><path d="M-6 6C-39 14-43-23-20-24C-43-59 20-70 18-29C49-42 54 8 11 9L20 32H-20Z"/><path d="M-30 86L0 74L30 86M0 74V94"/>`;
    default: return `<g transform="translate(-37 7) scale(.9)">${branch(8)}</g><g transform="translate(37 7) scale(-.9 .9)">${branch(8)}</g><g transform="translate(0 -6) scale(.64)">${fleur()}</g><path d="M-35 93Q0 61 35 93M0 72V106"/>`;
  }
}
function corner() {
  return `<path d="M0 81V0H81M8 59V8H59M0 37Q38 40 37 0M13 72Q51 54 48 21Q75 20 82 0M19 48C-5 23 49 5 34 37C27 52 10 41 19 31M48 21C64 45 81 5 59 11C48 14 55 24 61 18"/><g transform="translate(43 56) rotate(64) scale(.42)">${leaf}</g><g transform="translate(62 38) rotate(18) scale(.35)">${leaf}</g><circle cx="12" cy="12" r="2.5" fill="currentColor"/>`;
}
function cardSvg(t, width = 432, height = 604) {
  const p = t.id; const gold = t.gold;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 432 604"><defs>
    <linearGradient id="${p}-ink" x2="1" y2="1"><stop stop-color="${t.light}"/><stop offset=".5" stop-color="${t.ink}"/><stop offset="1" stop-color="${t.light}"/></linearGradient>
    <linearGradient id="${p}-foil" x2=".8" y2="1"><stop stop-color="#f3e2af"/><stop offset=".35" stop-color="${gold}"/><stop offset=".65" stop-color="#b0955e"/><stop offset="1" stop-color="#ead6a0"/></linearGradient>
    <pattern id="${p}-lattice" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M11 0L22 11L11 22L0 11Z" fill="none" stroke="${gold}" stroke-width=".55" opacity=".25"/><circle cx="11" cy="11" r="1" fill="${gold}" opacity=".45"/></pattern>
  </defs><rect x="1" y="1" width="430" height="602" rx="23" fill="#f4eddb"/><rect x="8" y="8" width="416" height="588" rx="18" fill="none" stroke="#c9bd9e" stroke-width="1"/><rect x="16" y="16" width="400" height="572" rx="12" fill="url(#${p}-ink)"/><rect x="23" y="23" width="386" height="558" rx="8" fill="url(#${p}-lattice)"/><g fill="none" stroke="url(#${p}-foil)" color="${gold}" stroke-linejoin="round" stroke-linecap="round"><rect x="24" y="24" width="384" height="556" rx="8" stroke-width="2"/><rect x="30" y="30" width="372" height="544" rx="5" stroke-width=".7"/><rect x="37" y="37" width="358" height="530" rx="3" stroke-width=".8"/>
  ${[[44,44,1,1],[388,44,-1,1],[44,560,1,-1],[388,560,-1,-1]].map(([x,y,sx,sy])=>`<g transform="translate(${x} ${y}) scale(${sx} ${sy})" stroke-width="1.35">${corner()}</g>`).join('')}
  <path d="M128 64Q216 104 304 64M128 540Q216 500 304 540"/><path d="M146 67Q216 130 286 67M146 537Q216 474 286 537" stroke-width=".65"/><g transform="translate(216 72) scale(.43)">${rosette(30,8)}</g><g transform="translate(216 532) scale(.43)">${rosette(30,8)}</g>
  <ellipse cx="216" cy="302" rx="133" ry="190" fill="${t.ink}" stroke-width="1.6"/><ellipse cx="216" cy="302" rx="126" ry="181" stroke-width=".65"/><ellipse cx="216" cy="302" rx="120" ry="173" stroke-width="1"/>
  <path d="${guilloche(0)}" stroke-width=".65"/><path d="${guilloche(Math.PI)}" stroke-width=".65"/>
  <path d="M111 300Q130 209 190 165M321 300Q302 209 242 165M111 304Q130 395 190 439M321 304Q302 395 242 439" opacity=".45"/>
  <g transform="translate(216 302)" stroke-width="1.8">${motif(t)}</g><g transform="translate(216 153) scale(.25)">${rosette(31,8)}</g><g transform="translate(216 451) scale(.25)">${rosette(31,8)}</g>
  <g transform="translate(65 302) scale(.36)">${rosette(28,8)}</g><g transform="translate(367 302) scale(.36)">${rosette(28,8)}</g></g></svg>`;
}
function boardSvg(t) {
  const tile = t.id === 'green-felt-club';
  const w = tile ? 2048 : t.id === 'spring-morning' ? 1671 : 1672; const h = tile ? 2048 : 941;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><radialGradient id="felt"><stop stop-color="${t.light}" stop-opacity=".27"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient><pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0H6M0 3H6" stroke="#fff" stroke-opacity=".023"/><path d="M0 0V6M3 0V6" stroke="#000" stroke-opacity=".065"/></pattern><linearGradient id="wood" x2="1" y2="1"><stop stop-color="#5b3e27"/><stop offset=".45" stop-color="${t.wood || '#282520'}"/><stop offset="1" stop-color="#58402c"/></linearGradient></defs><rect width="${w}" height="${h}" fill="${t.board}"/>${tile?'':`<rect width="${w}" height="${h}" fill="url(#felt)"/>`}<rect width="${w}" height="${h}" fill="url(#weave)"/>${tile?'':`
  ${t.wood?`<path d="M0 0H${w}V${h}H0Z M26 26V${h-26}H${w-26}V26Z" fill="url(#wood)" fill-rule="evenodd"/>${repeat(9,i=>`<rect x="${i*2}" y="${i*2}" width="${w-i*4}" height="${h-i*4}" rx="${i}" fill="none" stroke="#a47743" stroke-opacity=".09"/>`)}`:''}
  <g stroke="${t.gold}" fill="none"><rect x="34" y="34" width="${w-68}" height="${h-68}" rx="13" stroke-opacity=".24"/><rect x="40" y="40" width="${w-80}" height="${h-80}" rx="10" stroke-opacity=".1"/>
  ${[[52,52,1,1],[w-52,52,-1,1],[52,h-52,1,-1],[w-52,h-52,-1,-1]].map(([x,y,sx,sy])=>`<g transform="translate(${x} ${y}) scale(${sx*1.1} ${sy*1.1})" opacity=".24" stroke-width="1.25">${corner()}</g>`).join('')}
  <g transform="translate(${w/2} 38) scale(.22)" opacity=".28">${rosette(26,8)}</g><g transform="translate(${w/2} ${h-38}) scale(.22)" opacity=".28">${rosette(26,8)}</g></g>`}</svg>`;
}
function embed(svg, x, y, w, h, rotation = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation} ${w/2} ${h/2})">${svg.replace(/<svg[^>]*>/, `<svg x="0" y="0" width="${w}" height="${h}" viewBox="0 0 432 604">`)}</g>`;
}
for (const t of themes) {
  const dir = path.join(root,'themes',t.id); await mkdir(dir,{recursive:true});
  const width=t.id==='green-felt-club'?360:432, height=t.id==='green-felt-club'?480:604;
  const card=cardSvg(t,width,height), board=boardSvg(t);
  await writeFile(path.join(dir,'card-back.svg'),card);
  await writeFile(path.join(dir,'board-surface.svg'),board);
  await sharp(Buffer.from(card)).webp({quality:94,effort:6}).toFile(path.join(dir,'card-back.webp'));
  const boardName=t.id==='green-felt-club'?'board-surface.jpg':t.id==='burgundy-club'?'board-surface-refined.webp':'board-surface.webp';
  const boardRaster=sharp(Buffer.from(board));
  await (boardName.endsWith('.jpg')?boardRaster.jpeg({quality:92}):boardRaster.webp({quality:91,effort:6})).toFile(path.join(dir,boardName));
  if(t.id==='burgundy-club') await sharp(Buffer.from(board)).webp({quality:91,effort:6}).toFile(path.join(dir,'board-surface.webp'));
  if(t.id!=='green-felt-club') {
    await sharp(Buffer.from(card)).resize(165,230,{fit:'fill'}).webp({quality:94,effort:6}).toFile(path.join(dir,'shop-card-back.webp'));
    const preview=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><filter id="shadow" x="-.4" y="-.4" width="1.8" height="1.8"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".6"/></filter></defs>${board.replace(/<svg[^>]*>/,'<svg width="640" height="360" viewBox="0 0 1672 941">')}<g filter="url(#shadow)">${embed(card,186,48,155,217,-14)}${embed(card,292,64,155,217,10)}</g></svg>`;
    await sharp(Buffer.from(preview)).webp({quality:92,effort:6}).toFile(path.join(dir,'shop-preview.webp'));
  }
  console.log(`${t.id}: ${width}×${height} card, ${boardName}`);
}
const fan=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720"><defs><filter id="fan-shadow" x="-.5" y="-.5" width="2" height="2"><feDropShadow dx="0" dy="13" stdDeviation="12" flood-color="#071c17" flood-opacity=".28"/></filter></defs><g transform="translate(0 105)" filter="url(#fan-shadow)">${embed(cardSvg(themes[1]),126,85,232,324,-21)}${embed(cardSvg(themes[2]),360,86,232,324,21)}${embed(cardSvg(themes[0]),244,118,232,324,0)}</g></svg>`;
await mkdir(path.join(root,'ui/art'),{recursive:true});
await writeFile(path.join(root,'ui/art/theme-fan.svg'),fan);
console.log('Theme fan: 720×720 SVG');
