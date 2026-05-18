import type { Program, ProgramContext } from '../../kernel/program';
import { getRegistry } from '../../kernel/registry';

// demo — a montage that rips through the OS at speed, then erases itself so
// the visitor is left exactly where they started. The "clear" is precise:
// before running we snapshot how many lines are in the terminal scrollback,
// after running we delete only the lines added during the demo.

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Tight cadence — fast enough to feel like a sizzle reel, slow enough that
// you can read a word if you focus.
const TEXT_GAP_MS = 35;
const MODAL_HOLD_MS = 280;
const PANEL_HOLD_MS = 320;
const MUSIC_HOLD_MS = 700;

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
    await sleep(180);
    prog.onKey?.(ctx, {
      key: 'ArrowRight', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    });
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

async function runDemoBody(ctx: ProgramContext): Promise<void> {
  ctx.println('── demo ─ everything, very fast ────────────────────────────────');

  // Inline outputs — printed in rapid succession.
  const inlineSequence: Array<[string, string[]]> = [
    ['whoami', []],
    ['about', []],
    ['fortune', []],
    ['cowsay', ['ineği', 'gördüm']],
    ['figlet', ['orkan']],
    ['date', []],
    ['uname', []],
    ['uptime', []],
    ['ps', []],
    ['top', []],
    ['ping', ['istanbul']],
    ['whois', ['orkan']],
    ['whois', ['postmodern_dilenci']],
    ['whois', ['stowaway']],
    ['dilenci', []],
  ];
  for (const [name, args] of inlineSequence) {
    runInline(ctx, name, args);
    await sleep(TEXT_GAP_MS);
  }

  // Device reads
  for (const dev of ['/dev/heart', '/dev/wind', '/dev/harbor', '/dev/salt'] as const) {
    ctx.println(`$ cat ${dev}`);
    try { ctx.println(ctx.fs.read(dev)); } catch { /* */ }
    await sleep(TEXT_GAP_MS);
  }

  // Visuals — open / hold briefly / close
  await flashPanel(ctx, 'aquarium', PANEL_HOLD_MS);
  await flashPanel(ctx, 'latent', PANEL_HOLD_MS);
  await flashPanel(ctx, 'currency', PANEL_HOLD_MS);
  await flashGallery(ctx);
  await flashModal(ctx, 'life', MODAL_HOLD_MS);
  await flashModal(ctx, '2048', MODAL_HOLD_MS);

  // Music — quick taste
  ctx.println('$ music play harbor');
  const music = getRegistry().get('music');
  if (music?.onCommand) music.onCommand(ctx, ['music', 'play', 'harbor']);
  await sleep(MUSIC_HOLD_MS);
  if (music?.onCommand) music.onCommand(ctx, ['music', 'stop']);

  ctx.println('── demo end ───────────────────────────────────────────────────');
}

const prog: Program = {
  name: 'demo',
  manpage: 'demo — a few-second tour. erases itself when done.',
  category: 'discovery',
  mode: 'inline',
  onCommand: (ctx: ProgramContext) => {
    void runDemo(ctx);
    return;
  },
};

export default prog;
