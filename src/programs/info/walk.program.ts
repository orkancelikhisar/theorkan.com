import './walk.css';
import type { Program, ProgramContext } from '../../kernel/program';
import { getRegistry } from '../../kernel/registry';
import { PLACES, vignetteAt } from './walk-places';
import {
  freshState, step, linger, crossoverAt,
  type WalkState, type Direction,
} from './walk-engine';
import {
  OVERWORLD_GRID, OW_W, OW_H, tierOf,
} from './walk-map';

// walk — doryen-style overworld. Continuous rAF loop drives both the
// ambient water shimmer and player movement. Movement is held-key based
// (not event-driven), so the player walks at a constant rate as long as
// you hold a direction — OS keyboard auto-repeat is bypassed entirely.

const SPRITE = '◦';
const SHIMMER_FRAME_DIVISOR = 6;          // water shimmers every ~100ms at 60Hz
const STEP_INTERVAL_MS = 90;              // one tile per 90ms while a key is held

const cellEls: HTMLSpanElement[][] = [];
const staticChars: string[][] = OVERWORLD_GRID.map((r) => r.split(''));
const waterCells: Array<{ col: number; row: number; last: string }> = [];

let overlay: HTMLDivElement | null = null;
let titleEl: HTMLDivElement | null = null;
let counterEl: HTMLDivElement | null = null;
let mapEl: HTMLPreElement | null = null;
let proseEl: HTMLDivElement | null = null;
let hintEl: HTMLDivElement | null = null;
let keysEl: HTMLDivElement | null = null;

let state: WalkState = freshState();
let prevPlayerPos: { col: number; row: number } | null = null;
let frame = 0;
let rafHandle: number | null = null;

const heldKeys = new Set<Direction>();
let lastStepMs = 0;
let storedCtx: ProgramContext | null = null;
let docKeyDown: ((e: KeyboardEvent) => void) | null = null;
let docKeyUp: ((e: KeyboardEvent) => void) | null = null;

function buildMap(): void {
  if (!mapEl) return;
  mapEl.innerHTML = '';
  waterCells.length = 0;
  for (let r = 0; r < OW_H; r++) {
    cellEls[r] = [];
    for (let c = 0; c < OW_W; c++) {
      const ch = staticChars[r][c];
      const span = document.createElement('span');
      span.className = `walk__tile walk__tile--${tierOf(ch)}`;
      span.textContent = ch;
      mapEl.appendChild(span);
      cellEls[r][c] = span;
      if (ch === '~') waterCells.push({ col: c, row: r, last: '~' });
    }
    mapEl.appendChild(document.createTextNode('\n'));
  }
}

function renderPlayer(): void {
  if (prevPlayerPos) {
    const { col, row } = prevPlayerPos;
    const orig = staticChars[row][col];
    const cell = cellEls[row]?.[col];
    if (cell) {
      cell.textContent = orig;
      cell.className = `walk__tile walk__tile--${tierOf(orig)}`;
    }
  }
  const cell = cellEls[state.pos.row]?.[state.pos.col];
  if (cell) {
    cell.textContent = SPRITE;
    cell.className = 'walk__tile walk__tile--player';
  }
  prevPlayerPos = { ...state.pos };
}

function renderHintAndCounter(): void {
  if (counterEl) counterEl.textContent = `step ${String(state.totalSteps).padStart(3, '0')}`;
  if (!hintEl) return;
  const cross = crossoverAt(state);
  if (cross && PLACES[state.currentZone ?? '']) {
    const place = PLACES[state.currentZone!];
    const hintText = place.crossover?.hint ?? `enter ${cross.command}`;
    hintEl.textContent = `▸ ${hintText}    [space] enter`;
    hintEl.style.opacity = '1';
  } else {
    hintEl.textContent = '';
    hintEl.style.opacity = '0';
  }
}

function renderProse(): void {
  if (!titleEl || !proseEl) return;
  const place = state.currentZone ? PLACES[state.currentZone] : null;
  titleEl.textContent = place?.title ?? '—';
  if (place) {
    const visits = state.visits[place.id] ?? 1;
    proseEl.textContent = vignetteAt(place.id, visits);
  } else {
    proseEl.textContent = '';
  }
  renderHintAndCounter();
}

function performStep(dir: Direction): void {
  const before = state.currentZone;
  const result = step(state, dir);
  state = result.state;
  renderPlayer();
  if (state.currentZone !== before) renderProse();
  else renderHintAndCounter();
}

function tick(): void {
  rafHandle = requestAnimationFrame(tick);
  frame += 1;

  // Held-key auto-walk. As long as a direction is in the set, advance one
  // tile every STEP_INTERVAL_MS — constant cadence, regardless of OS auto-
  // repeat timings.
  if (heldKeys.size > 0) {
    const now = performance.now();
    if (now - lastStepMs >= STEP_INTERVAL_MS) {
      // Most-recently-pressed key wins (changes direction immediately if
      // the player swaps from holding → to up while → is still down).
      const dirs = [...heldKeys];
      const dir = dirs[dirs.length - 1];
      performStep(dir);
      lastStepMs = now;
    }
  }

  // Water shimmer
  if (frame % SHIMMER_FRAME_DIVISOR === 0) {
    const phaseFrame = Math.floor(frame / SHIMMER_FRAME_DIVISOR);
    for (const w of waterCells) {
      const phase = (w.col * 7 + w.row * 13 + phaseFrame) % 30;
      const next = phase < 2 ? ' ' : '~';
      if (next !== w.last) {
        const cell = cellEls[w.row]?.[w.col];
        if (cell) cell.textContent = next;
        w.last = next;
      }
    }
  }
}

function startFrameLoop(): void {
  stopFrameLoop();
  lastStepMs = performance.now();
  rafHandle = requestAnimationFrame(tick);
}

function stopFrameLoop(): void {
  if (rafHandle != null) { cancelAnimationFrame(rafHandle); rafHandle = null; }
}

function keyToDir(k: string): Direction | null {
  if (k === 'ArrowUp'    || k === 'w' || k === 'W' || k === 'k') return 'up';
  if (k === 'ArrowDown'  || k === 's' || k === 'S' || k === 'j') return 'down';
  if (k === 'ArrowLeft'  || k === 'a' || k === 'A' || k === 'h') return 'left';
  if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'l') return 'right';
  return null;
}

function dispatchCrossover(ctx: ProgramContext, command: string, argv?: string[]): void {
  close();
  const prog = getRegistry().get(command);
  if (!prog) return;
  const full = [command, ...(argv ?? [])];
  try {
    if (prog.onCommand) {
      const out = prog.onCommand(ctx, full);
      if (typeof out === 'string') ctx.println(out);
    } else if (prog.init) {
      void prog.init(ctx);
    }
  } catch (e) {
    ctx.println(`walk: could not enter — ${(e as Error).message}`);
  }
}

function attachKeyHandlers(ctx: ProgramContext): void {
  storedCtx = ctx;

  docKeyDown = (e: KeyboardEvent) => {
    if (!overlay) return;
    // OS auto-repeat events: swallow and ignore; the rAF loop drives motion.
    if (e.repeat) { e.preventDefault(); e.stopPropagation(); return; }

    const dir = keyToDir(e.key);
    if (dir) {
      e.preventDefault(); e.stopPropagation();
      if (!heldKeys.has(dir)) {
        heldKeys.add(dir);
        // Immediate first step so the press feels responsive (no 90ms delay).
        performStep(dir);
        lastStepMs = performance.now();
      }
      return;
    }

    if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      state = linger(state);
      renderProse();
      return;
    }
    if (e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar') {
      e.preventDefault(); e.stopPropagation();
      const cross = crossoverAt(state);
      if (cross && storedCtx) dispatchCrossover(storedCtx, cross.command, cross.argv);
      return;
    }
  };

  docKeyUp = (e: KeyboardEvent) => {
    const dir = keyToDir(e.key);
    if (dir) {
      heldKeys.delete(dir);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // capture: true so we see the event BEFORE it reaches the terminal input;
  // stopPropagation() in the handlers prevents the input from also acting on it.
  document.addEventListener('keydown', docKeyDown, { capture: true });
  document.addEventListener('keyup', docKeyUp, { capture: true });
}

function detachKeyHandlers(): void {
  if (docKeyDown) document.removeEventListener('keydown', docKeyDown, { capture: true });
  if (docKeyUp) document.removeEventListener('keyup', docKeyUp, { capture: true });
  docKeyDown = null;
  docKeyUp = null;
  heldKeys.clear();
  storedCtx = null;
}

function close(): void {
  detachKeyHandlers();
  stopFrameLoop();
  if (overlay) overlay.remove();
  overlay = null;
  titleEl = null; counterEl = null; mapEl = null;
  proseEl = null; hintEl = null; keysEl = null;
  prevPlayerPos = null;
  cellEls.length = 0;
  const input = document.querySelector('.terminal__input');
  if (input instanceof HTMLElement) input.focus();
}

const prog: Program = {
  name: 'walk',
  aliases: ['wander'],
  manpage:
    'walk — wander orkan’s places, doryen-style.\n' +
    '  hold an arrow key (or wasd / hjkl) to walk in that direction.\n' +
    '  the player moves at a constant cadence while the key is held.\n' +
    '  walk into a building doorway to enter it. tiles G M d C are\n' +
    '  interactive — press [space] on one to launch another program.\n' +
    '  [enter] linger here — pick a new vignette at this place.\n' +
    '  [q] or [esc] to leave. state persists across opens.',
  category: 'info',
  mode: 'modal',
  overlaySelector: '.walk-overlay',
  init: (ctx) => {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'walk-overlay';

    const frameEl = document.createElement('div');
    frameEl.className = 'walk-frame';

    const top = document.createElement('div');
    top.className = 'walk-frame__top';
    titleEl = document.createElement('div');
    titleEl.className = 'walk-frame__title';
    counterEl = document.createElement('div');
    counterEl.className = 'walk-frame__counter';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'walk-frame__close';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'leave');
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    top.append(titleEl, counterEl, closeBtn);
    frameEl.appendChild(top);

    mapEl = document.createElement('pre');
    mapEl.className = 'walk-frame__map';
    frameEl.appendChild(mapEl);

    proseEl = document.createElement('div');
    proseEl.className = 'walk-frame__prose';
    frameEl.appendChild(proseEl);

    hintEl = document.createElement('div');
    hintEl.className = 'walk-frame__hint';
    frameEl.appendChild(hintEl);

    keysEl = document.createElement('div');
    keysEl.className = 'walk-frame__keys';
    keysEl.textContent = 'hold ↑ ↓ ← → to walk    [space] enter    [enter] linger    [q] leave';
    frameEl.appendChild(keysEl);

    overlay.appendChild(frameEl);
    document.body.appendChild(overlay);

    buildMap();
    renderProse();
    renderPlayer();
    attachKeyHandlers(ctx);
    startFrameLoop();
  },
  // onKey deliberately unused — keys are captured at the document level
  // for held-key motion. Provided as a no-op so the modal contract holds.
  onKey: () => {},
  render: () => {},
  cleanup: () => close(),
};

export default prog;
