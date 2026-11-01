// Draws an offline SVG illustration for every product and kit, into client/public/img.
// Run with: node server/seed/generateImages.js
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from '../src/config/env.js';
import { slugify } from '../src/utils/http.js';
import { kits, products } from './data/catalog.js';

const OUTPUT = path.join(PROJECT_ROOT, 'client', 'public', 'img');

// Each category has its own colour pair, so products are easy to tell apart in a grid.
const PALETTES = {
  'dev-hardware': ['#0f766e', '#042f2e'],
  laptops: ['#3730a3', '#1e1b4b'],
  peripherals: ['#6d28d9', '#2e1065'],
  'laptop-accessories': ['#0369a1', '#082f49'],
  'storage-cables': ['#0e7490', '#083344'],
  'cs-textbooks': ['#b45309', '#451a03'],
  'software-licenses': ['#15803d', '#052e16'],
  stationery: ['#be123c', '#4c0519'],
  backpacks: ['#4d7c0f', '#1a2e05'],
  'college-merch': ['#a21caf', '#4a044e'],
  'daily-essentials': ['#c2410c', '#431407'],
};

// Line drawings on a 400 by 400 canvas, roughly centred.
const ART = {
  board: `<rect x="110" y="120" width="180" height="150" rx="10"/><rect x="170" y="165" width="60" height="60" rx="4"/><path d="M135 120v-16M160 120v-16M185 120v-16M210 120v-16M235 120v-16M260 120v-16M135 270v16M160 270v16M185 270v16M210 270v16M235 270v16M260 270v16"/><circle cx="130" cy="145" r="5"/><circle cx="270" cy="245" r="5"/><path d="M230 195h30M140 195h30"/>`,
  chip: `<rect x="140" y="140" width="120" height="120" rx="10"/><rect x="170" y="170" width="60" height="60" rx="4"/><path d="M165 140v-24M200 140v-24M235 140v-24M165 260v24M200 260v24M235 260v24M140 165h-24M140 200h-24M140 235h-24M260 165h24M260 200h24M260 235h24"/>`,
  sensor: `<rect x="145" y="190" width="110" height="85" rx="8"/><circle cx="175" cy="232" r="16"/><circle cx="225" cy="232" r="16"/><path d="M160 190v-20M240 190v-20"/><path d="M150 150a70 70 0 0 1 100 0M170 128a105 105 0 0 1 60 0"/>`,
  tool: `<rect x="150" y="110" width="100" height="180" rx="14"/><rect x="168" y="130" width="64" height="44" rx="4"/><circle cx="200" cy="222" r="26"/><path d="M200 222l14-14"/><path d="M178 268h44"/>`,
  laptop: `<rect x="125" y="125" width="150" height="105" rx="8"/><path d="M95 262h210l-20-32H115z"/><path d="M185 248h30"/><path d="M150 155h26M150 175h52M150 195h36"/>`,
  keyboard: `<rect x="90" y="150" width="220" height="110" rx="12"/><path d="M112 175h12M140 175h12M168 175h12M196 175h12M224 175h12M252 175h12M280 175h8M112 203h12M140 203h12M168 203h12M196 203h12M224 203h12M252 203h12M280 203h8M135 235h130"/>`,
  mouse: `<rect x="150" y="110" width="100" height="180" rx="50"/><path d="M200 110v62M150 172h100"/><rect x="194" y="130" width="12" height="24" rx="6"/>`,
  monitor: `<rect x="95" y="110" width="210" height="140" rx="10"/><path d="M200 250v35M155 290h90"/><path d="M125 145l24 20-24 20M165 190h40"/>`,
  headset: `<path d="M115 225v-25a85 85 0 0 1 170 0v25"/><rect x="95" y="215" width="40" height="70" rx="14"/><rect x="265" y="215" width="40" height="70" rx="14"/>`,
  stand: `<path d="M110 165l180-30"/><path d="M125 170l-20 110M275 145l20 135M95 285h40M270 285h40"/><path d="M155 225h90"/>`,
  hub: `<rect x="125" y="150" width="150" height="90" rx="14"/><path d="M125 195H80M275 195h45"/><rect x="150" y="178" width="26" height="14" rx="2"/><rect x="186" y="178" width="26" height="14" rx="2"/><rect x="222" y="178" width="26" height="14" rx="2"/><path d="M152 212h96"/>`,
  charger: `<rect x="140" y="140" width="120" height="120" rx="18"/><path d="M175 140v-30M225 140v-30"/><path d="M210 165l-28 42h28l-14 34"/>`,
  sleeve: `<rect x="95" y="125" width="210" height="150" rx="16"/><path d="M95 165h210"/><rect x="185" y="155" width="30" height="20" rx="5"/><path d="M125 215h150M125 240h90"/>`,
  webcam: `<circle cx="200" cy="170" r="60"/><circle cx="200" cy="170" r="26"/><circle cx="200" cy="170" r="8"/><path d="M170 225l-15 50h90l-15-50"/>`,
  ssd: `<rect x="140" y="100" width="120" height="200" rx="14"/><path d="M170 300v-30h60v30"/><path d="M165 135h70M165 160h40"/><circle cx="200" cy="215" r="24"/>`,
  usb: `<rect x="155" y="170" width="90" height="125" rx="12"/><rect x="172" y="110" width="56" height="60" rx="4"/><path d="M188 130h8M204 130h8"/><path d="M180 205h40"/>`,
  cable: `<path d="M110 130h40a40 40 0 0 1 40 40v60a40 40 0 0 0 40 40h60"/><rect x="85" y="115" width="35" height="30" rx="6"/><rect x="280" y="255" width="35" height="30" rx="6"/><path d="M85 122h-16M85 138h-16M315 262h16M315 278h16"/>`,
  book: `<path d="M110 110h150a30 30 0 0 1 30 30v150H140a30 30 0 0 1-30-30z"/><path d="M110 260a30 30 0 0 1 30-30h150"/>`,
  key: `<circle cx="150" cy="200" r="48"/><circle cx="150" cy="200" r="16"/><path d="M198 200h110M270 200v32M300 200v24"/>`,
  cloud: `<path d="M135 260a55 55 0 0 1-5-110 75 75 0 0 1 142-12 60 60 0 0 1 5 122z"/><path d="M200 180v60M178 218l22 22 22-22"/>`,
  notebook: `<rect x="125" y="100" width="165" height="200" rx="10"/><path d="M155 100v200M105 135h35M105 170h35M105 205h35M105 240h35M105 275h35"/><path d="M180 145h85M180 175h60"/>`,
  pen: `<path d="M265 105l30 30-145 145-40 10 10-40z"/><path d="M240 130l30 30"/><path d="M120 280l10-10"/>`,
  calculator: `<rect x="135" y="95" width="130" height="210" rx="12"/><rect x="155" y="118" width="90" height="42" rx="4"/><path d="M165 190h10M195 190h10M225 190h10M165 225h10M195 225h10M225 225h10M165 260h10M195 260h10M225 260h10"/>`,
  sticky: `<rect x="95" y="115" width="210" height="150" rx="6"/><path d="M125 150h100M125 180h150M125 210h70"/><path d="M95 290h210"/><path d="M240 225l35 35"/>`,
  backpack: `<path d="M130 175a70 70 0 0 1 140 0v120a12 12 0 0 1-12 12H142a12 12 0 0 1-12-12z"/><path d="M170 105a30 30 0 0 1 60 0"/><rect x="155" y="225" width="90" height="55" rx="8"/><path d="M155 245h90"/>`,
  hoodie: `<path d="M150 125l-55 45 20 45 30-16v105h110V199l30 16 20-45-55-45"/><path d="M150 125a55 45 0 0 0 100 0"/><path d="M175 255h50l10 49h-70z"/><path d="M190 165v30M210 165v30"/>`,
  tshirt: `<path d="M150 115l-60 40 20 45 35-16v120h110V184l35 16 20-45-60-40"/><path d="M150 115a55 28 0 0 0 100 0"/><path d="M175 200h50"/>`,
  sticker: `<path d="M120 120h160v110l-50 50H120z"/><path d="M230 280v-50h50"/><path d="M160 180l-20 20 20 20M210 180l20 20-20 20"/>`,
  mug: `<path d="M120 130h130v130a30 30 0 0 1-30 30h-70a30 30 0 0 1-30-30z"/><path d="M250 165h20a30 30 0 0 1 0 60h-20"/><path d="M155 100v-15M185 100v-15M215 100v-15"/>`,
  bottle: `<path d="M170 145v-30h60v30l15 30v115a15 15 0 0 1-15 15h-60a15 15 0 0 1-15-15V175z"/><rect x="165" y="90" width="70" height="25" rx="5"/><path d="M155 210h90"/>`,
  lamp: `<path d="M140 150l80-40 45 70-80 40z"/><path d="M185 200l-35 60"/><path d="M150 260l45 25"/><path d="M110 295h100"/><path d="M255 225l15 20M225 240l10 22"/>`,
  powerbank: `<rect x="130" y="105" width="140" height="195" rx="16"/><path d="M215 145l-34 55h38l-34 55"/><path d="M155 280h6M172 280h6M189 280h6"/>`,
  plug: `<rect x="90" y="170" width="220" height="70" rx="12"/><circle cx="125" cy="205" r="12"/><circle cx="175" cy="205" r="12"/><circle cx="225" cy="205" r="12"/><circle cx="275" cy="205" r="12"/><path d="M90 205H60v65"/>`,
};

const escapeXml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function frame(light, dark, id, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <pattern id="dots-${id}" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.2" fill="#ffffff" opacity="0.13"/>
    </pattern>
  </defs>
  <rect width="400" height="400" fill="url(#bg-${id})"/>
  <rect width="400" height="400" fill="url(#dots-${id})"/>
${inner}
</svg>
`;
}

function drawing(art) {
  return `  <g fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${ART[art]}</g>`;
}

function brandLabel(brand) {
  return `  <text x="200" y="362" text-anchor="middle" font-family="'JetBrains Mono',Consolas,monospace" font-size="17" fill="#ffffff" opacity="0.82">${escapeXml(brand)}</text>`;
}

/** Textbooks show their title on the cover instead of a generic drawing. */
function bookCover(product) {
  const lines = product.cover ?? [product.name];
  const start = 165 - (lines.length - 1) * 18;
  const title = lines
    .map(
      (line, index) =>
        `<text x="215" y="${start + index * 36}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="${line.length > 14 ? 21 : 26}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
    )
    .join('');
  return `  <g transform="translate(0 0)">
    <rect x="115" y="62" width="200" height="272" rx="8" fill="#000000" opacity="0.28"/>
    <rect x="105" y="52" width="200" height="272" rx="8" fill="#000000" opacity="0.25" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2"/>
    <rect x="105" y="52" width="16" height="272" fill="#ffffff" opacity="0.28"/>
    <path d="M145 95h120" stroke="#ffffff" stroke-width="3" opacity="0.7"/>
  </g>
  <g transform="translate(-5 0)">${title}</g>
  <text x="210" y="285" text-anchor="middle" font-family="'JetBrains Mono',Consolas,monospace" font-size="12" fill="#ffffff" opacity="0.88">${escapeXml(product.author ?? '')}</text>`;
}

function writeSvg(folder, slug, svg) {
  fs.mkdirSync(path.join(OUTPUT, folder), { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, folder, `${slug}.svg`), svg);
}

for (const product of products) {
  const slug = slugify(product.name);
  const [light, dark] = PALETTES[product.category];
  const inner = product.art === 'book' ? bookCover(product) : drawing(product.art);
  writeSvg('products', slug, frame(light, dark, slug, `${inner}\n${brandLabel(product.brand)}`));
}

for (const kit of kits) {
  const slug = slugify(kit.name);
  const inner = `${drawing(kit.art)}\n  <text x="200" y="362" text-anchor="middle" font-family="'JetBrains Mono',Consolas,monospace" font-size="17" fill="#ffffff" opacity="0.88">PROJECT KIT</text>`;
  writeSvg('kits', slug, frame('#4338ca', '#0f172a', slug, inner));
}

console.log(`Drew ${products.length} products and ${kits.length} kits in ${OUTPUT}`);
