import type { Program, ProgramContext } from '../../kernel/program';

// currency — abstract value-symbols, morphing. References Orkan's Currency
// Experiment series. Currency glyphs migrate slowly through a grid; each
// cycle a small fraction get replaced. Some cells get struck through.

const W = 28;
const H = 12;
const TICK_MS = 380;
const SYMBOLS = ['₺', '$', '€', '¥', '₿', '₽', '₹', '฿', '₩', '₱', '₪', 'ƒ', '₣'];
const STRIKETHROUGH = '─';           // replacement glyph for "cancelled" cells

interface ActiveCurrency {
  panelId: string;
  cells: string[];                    // W*H of currency symbols
  struck: boolean[];                  // parallel flag per cell
  timer: number | null;
  contentEl: HTMLElement;
}

let active: ActiveCurrency | null = null;

function paint(): void {
  if (!active) return;
  const rows: string[] = [];
  for (let r = 0; r < H; r++) {
    let line = '';
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      line += active.struck[i] ? STRIKETHROUGH : active.cells[i];
      line += '  ';                    // spacing between glyphs
    }
    rows.push(line);
  }
  active.contentEl.textContent = rows.join('\n');
}

function tick(): void {
  if (!active) return;
  const swaps = 12;
  for (let i = 0; i < swaps; i++) {
    const idx = Math.floor(Math.random() * W * H);
    // ~30% chance the cell becomes "cancelled". Otherwise rotate to another
    // currency symbol. Struck cells can un-strike with low probability.
    if (active.struck[idx]) {
      if (Math.random() < 0.18) {
        active.struck[idx] = false;
        active.cells[idx] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      }
    } else if (Math.random() < 0.32) {
      active.struck[idx] = true;
    } else {
      active.cells[idx] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    }
  }
  paint();
}

function close(): void {
  if (!active) return;
  if (active.timer != null) { clearInterval(active.timer); active.timer = null; }
  active = null;
}

const prog: Program = {
  name: 'currency',
  manpage: 'currency — value-symbols, morphing. floating panel; close to stop.',
  category: 'art',
  mode: 'inline',
  onCommand: (ctx: ProgramContext) => {
    if (active) {
      ctx.println('currency: already open.');
      return;
    }
    const cells = new Array(W * H).fill('').map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    const struck = new Array(W * H).fill(false).map(() => Math.random() < 0.12);

    const wrap = document.createElement('pre');
    wrap.style.margin = '0';
    wrap.style.padding = '14px';
    wrap.style.whiteSpace = 'pre';
    wrap.style.fontFamily = 'var(--font-mono)';
    wrap.style.fontSize = '13px';
    wrap.style.lineHeight = '1.4';
    wrap.style.color = 'var(--bone)';
    wrap.style.letterSpacing = '0';

    const panelId = ctx.panel.spawn({
      title: 'currency experiment',
      contentEl: wrap,
      position: 'center',
      width: 380,
      height: 280,
      onClose: () => close(),
    });

    active = { panelId, cells, struck, timer: null, contentEl: wrap };
    paint();
    active.timer = window.setInterval(tick, TICK_MS);
  },
};

export default prog;
