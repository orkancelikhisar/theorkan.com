import type { Program, ProgramContext } from '../../kernel/program';

// latent — Istanbul Latent Walk, in ASCII. A field of glyphs that mutates
// slowly, seeded by the date so each day looks slightly different. Panel.

const W = 56;
const H = 18;
const TICK_MS = 220;
const MUTATION_FRACTION = 0.04;       // ~4% of cells reroll per tick

const PALETTE_NIGHT = '.,\'`"~:;-_|/\\*+^<>'.split('');
const PALETTE_DAY   = '.,\'`":;-_|/\\^'.split('');
// Sparse heavier tokens that occasionally drift through.
const ACCENTS = ['◦', '·', '✦', '×', '◊', '∙', '∘'];

interface ActiveLatent {
  panelId: string;
  grid: string[];                     // flat W*H buffer
  timer: number | null;
  contentEl: HTMLElement;
}

let active: ActiveLatent | null = null;

// Deterministic PRNG seeded by date so daily walks differ. Mulberry32.
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(): number {
  const d = new Date();
  return d.getFullYear() * 1_0000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function paletteForHour(hour: number): string[] {
  // Night (~22-06) reaches for the heavier set; daytime keeps to lighter chars.
  return hour >= 6 && hour < 20 ? PALETTE_DAY : PALETTE_NIGHT;
}

function fillInitial(rng: () => number, palette: string[]): string[] {
  const out: string[] = new Array(W * H);
  for (let i = 0; i < out.length; i++) {
    // Heavy bias toward space so the field is mostly empty, with chars adrift.
    if (rng() < 0.62) out[i] = ' ';
    else if (rng() < 0.03) out[i] = ACCENTS[Math.floor(rng() * ACCENTS.length)];
    else out[i] = palette[Math.floor(rng() * palette.length)];
  }
  return out;
}

function paint(): void {
  if (!active) return;
  const rows: string[] = [];
  for (let r = 0; r < H; r++) {
    rows.push(active.grid.slice(r * W, (r + 1) * W).join(''));
  }
  active.contentEl.textContent = rows.join('\n');
}

function tick(): void {
  if (!active) return;
  const palette = paletteForHour(new Date().getHours());
  const rng = Math.random;
  const mutations = Math.floor(W * H * MUTATION_FRACTION);
  for (let i = 0; i < mutations; i++) {
    const idx = Math.floor(rng() * W * H);
    const roll = rng();
    if (roll < 0.55) active.grid[idx] = ' ';
    else if (roll < 0.62) active.grid[idx] = ACCENTS[Math.floor(rng() * ACCENTS.length)];
    else active.grid[idx] = palette[Math.floor(rng() * palette.length)];
  }
  paint();
}

function close(): void {
  if (!active) return;
  if (active.timer != null) { clearInterval(active.timer); active.timer = null; }
  active = null;
}

const prog: Program = {
  name: 'latent',
  manpage: 'latent — istanbul latent walk. a panel of drifting glyphs, seeded daily.',
  category: 'art',
  mode: 'inline',
  onCommand: (ctx: ProgramContext) => {
    if (active) {
      ctx.println('latent: already open. close the panel to restart.');
      return;
    }
    const palette = paletteForHour(new Date().getHours());
    const rng = seededRng(dateSeed());
    const initial = fillInitial(rng, palette);

    const wrap = document.createElement('pre');
    wrap.style.margin = '0';
    wrap.style.padding = '14px';
    wrap.style.whiteSpace = 'pre';
    wrap.style.fontFamily = 'var(--font-mono)';
    wrap.style.fontSize = '12px';
    wrap.style.lineHeight = '1.1';
    wrap.style.color = 'var(--bone-dim)';
    wrap.style.letterSpacing = '0.5px';

    const panelId = ctx.panel.spawn({
      title: 'latent walk',
      contentEl: wrap,
      position: 'center',
      width: 520,
      height: 320,
      onClose: () => close(),
    });

    active = { panelId, grid: initial, timer: null, contentEl: wrap };
    paint();
    active.timer = window.setInterval(tick, TICK_MS);
  },
};

export default prog;
