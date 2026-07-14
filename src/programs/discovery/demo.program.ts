import type { Program, ProgramContext } from '../../kernel/program';
import { getRegistry } from '../../kernel/registry';

// demo — a montage that rips through the OS at speed, then erases itself so
// the visitor is left exactly where they started. Before running we snapshot
// how many lines are in the terminal scrollback; after running we delete
// only the lines added during the demo.

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Cadence — fast enough to feel like a sizzle reel, slow enough that you
// can read a word if you focus.
const TEXT_GAP_MS = 28;
const MODAL_HOLD_MS = 220;
const PANEL_HOLD_MS = 260;
const MUSIC_HOLD_MS = 600;

function snapshotLines(): { container: HTMLElement | null; count: number } {
  const container = document.querySelector('.terminal__lines') as HTMLElement | null;
  return { container, count: container?.children.length ?? 0 };
}

function clearAddedLines(mark: { container: HTMLElement | null; count: number }): void {
  if (!mark.container) return;
  while (mark.container.children.length > mark.count) {
    mark.container.lastElementChild?.remove();
  }
}

function runInline(ctx: ProgramContext, name: string, args: string[] = []): void {
  const prog = getRegistry().get(name);
  ctx.println(`$ ${name}${args.length ? ' ' + args.join(' ') : ''}`);
  if (!prog || !prog.onCommand) return;
  try {
    const out = prog.onCommand(ctx, [name, ...args]);
    if (typeof out === 'string') ctx.println(out);
  } catch { /* */ }
}

async function flashModal(ctx: ProgramContext, name: string, holdMs: number): Promise<void> {
  const prog = getRegistry().get(name);
  ctx.println(`$ ${name}`);
  if (!prog) return;
  try { await prog.init?.(ctx); } catch { /* */ }
  await sleep(holdMs);
  try { prog.cleanup?.(ctx); } catch { /* */ }
}

async function flashPanel(ctx: ProgramContext, name: string, holdMs: number): Promise<void> {
  const prog = getRegistry().get(name);
  ctx.println(`$ ${name}`);
  if (!prog) return;
  try {
    if (prog.onCommand) prog.onCommand(ctx, [name]);
    else if (prog.init) await prog.init(ctx);
  } catch { /* */ }
  await sleep(holdMs);
  ctx.panel.closeAll();
}

async function flashGallery(ctx: ProgramContext): Promise<void> {
  const prog = getRegistry().get('gallery');
  if (!prog) return;
  ctx.println('$ gallery');
  try { await prog.init?.(ctx); } catch { /* */ }
  for (let i = 0; i < 3; i++) {
    await sleep(160);
    prog.onKey?.(ctx, {
      key: 'ArrowRight', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    });
  }
  await sleep(180);
  try { prog.cleanup?.(ctx); } catch { /* */ }
}

async function flashWalk(ctx: ProgramContext): Promise<void> {
  // Walk uses document-level key capture (held-key model), so we dispatch
  // real KeyboardEvents rather than calling onKey directly.
  const prog = getRegistry().get('walk');
  if (!prog) return;
  ctx.println('$ walk');
  try { await prog.init?.(ctx); } catch { /* */ }
  const moves = ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight'];
  for (const key of moves) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await sleep(95);
    document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  }
  await sleep(200);
  try { prog.cleanup?.(ctx); } catch { /* */ }
}

async function runDemo(ctx: ProgramContext): Promise<void> {
  const mark = snapshotLines();
  try {
    await runDemoBody(ctx);
  } catch (e) {
    console.warn('[demo] aborted early', e);
  } finally {
    await sleep(120);
    clearAddedLines(mark);
  }
}

// All inline programs the visitor can type, with sensible args where needed.
const INLINE_SEQUENCE: Array<[string, string[]]> = [
  ['help', []],
  ['whoami', []],
  ['about', []],
  ['projects', []],
  ['contact', []],
  ['cv', []],
  ['man-orkan', []],
  ['fortune', []],
  ['cowsay', ['ineği', 'gördüm']],
  ['figlet', ['orkan']],
  ['say', ['salt']],
  ['date', []],
  ['uname', []],
  ['uptime', []],
  ['ps', []],
  ['top', []],
  ['ping', ['istanbul']],
  ['weather', []],
  ['motd', []],
  ['hints', []],
  ['secrets', []],
  ['bbs', []],
  ['man', ['the harbor']],
  ['whois', ['orkan']],
  ['whois', ['postmodern_dilenci']],
  ['whois', ['stowaway']],
  ['pinpoint', []],
  ['dilenci', []],
];

const DEVICES = ['/dev/heart', '/dev/wind', '/dev/harbor', '/dev/tide', '/dev/salt', '/dev/regret'] as const;

const PANELS = ['aquarium', 'latent'];

const MODAL_SCHEDULE: Array<{ name: string; hold: number } | { name: 'gallery' | 'walk' }> = [
  { name: 'gallery' },
  { name: 'undertow', hold: 1_200 },
  { name: 'walk' },
  { name: 'life',    hold: MODAL_HOLD_MS },
  { name: '2048',    hold: MODAL_HOLD_MS },
  { name: 'snake',   hold: MODAL_HOLD_MS },
  { name: 'regatta', hold: MODAL_HOLD_MS },
];

async function runDemoBody(ctx: ProgramContext): Promise<void> {
  ctx.println('── demo ─ a tour of everything, very fast ─────────────────────');

  // Inline outputs first — they print as a fast scroll.
  for (const [name, args] of INLINE_SEQUENCE) {
    runInline(ctx, name, args);
    await sleep(TEXT_GAP_MS);
  }

  // Device reads
  for (const dev of DEVICES) {
    ctx.println(`$ cat ${dev}`);
    try { ctx.println(ctx.fs.read(dev)); } catch { /* */ }
    await sleep(TEXT_GAP_MS);
  }

  // Panel-mode visuals: aquarium, latent
  for (const name of PANELS) {
    await flashPanel(ctx, name, PANEL_HOLD_MS);
  }

  // Modal visuals: gallery (with arrow navigation), walk (with movement),
  // then the games.
  for (const item of MODAL_SCHEDULE) {
    if (item.name === 'gallery')   await flashGallery(ctx);
    else if (item.name === 'walk') await flashWalk(ctx);
    else                            await flashModal(ctx, item.name, (item as { hold: number }).hold);
  }

  // Music — quick taste
  ctx.println('$ music play harbor');
  const music = getRegistry().get('music');
  if (music?.onCommand) music.onCommand(ctx, ['music', 'play', 'harbor']);
  await sleep(MUSIC_HOLD_MS);
  if (music?.onCommand) music.onCommand(ctx, ['music', 'stop']);

  ctx.println('── demo end ──────────────────────────────────────────────────');
}

const prog: Program = {
  name: 'demo',
  manpage: 'demo — a fast tour of every app. erases itself when done.',
  category: 'discovery',
  mode: 'inline',
  onCommand: (ctx: ProgramContext) => {
    void runDemo(ctx);
    return;
  },
};

export default prog;
