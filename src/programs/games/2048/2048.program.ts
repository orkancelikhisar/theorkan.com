import './2048.css';
import type { Program, KeyEvent } from '../../../kernel/program';

const HIGH_KEY = 'theorkan.2048.high';
type Board = number[][];

interface GameState {
  board: Board;
  score: number;
  overlay: HTMLElement | null;
  boardEl: HTMLElement | null;
  statusEl: HTMLElement | null;
}

const state: GameState = {
  board: [],
  score: 0,
  overlay: null,
  boardEl: null,
  statusEl: null,
};

function empty(): Board {
  return Array.from({ length: 4 }, () => [0, 0, 0, 0]);
}
function addRandom(b: Board): void {
  const free: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (b[r][c] === 0) free.push({ r, c });
  if (free.length === 0) return;
  const { r, c } = free[Math.floor(Math.random() * free.length)];
  b[r][c] = Math.random() < 0.9 ? 2 : 4;
}
function rotate(b: Board): Board {
  const out = empty();
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c][3 - r] = b[r][c];
  return out;
}
function slideRow(row: number[]): { row: number[]; score: number } {
  const filtered = row.filter((n) => n !== 0);
  let gained = 0;
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2;
      gained += filtered[i];
      filtered.splice(i + 1, 1);
    }
  }
  while (filtered.length < 4) filtered.push(0);
  return { row: filtered, score: gained };
}
function slide(b: Board): { board: Board; gained: number; moved: boolean } {
  const out = empty();
  let gained = 0;
  let moved = false;
  for (let r = 0; r < 4; r++) {
    const { row, score } = slideRow(b[r]);
    if (row.join() !== b[r].join()) moved = true;
    out[r] = row; gained += score;
  }
  return { board: out, gained, moved };
}
function move(dir: 'left'|'right'|'up'|'down'): boolean {
  let b = state.board;
  const rotations = { left: 0, up: 1, right: 2, down: 3 }[dir];
  for (let i = 0; i < rotations; i++) b = rotate(b);
  const result = slide(b);
  let after = result.board;
  for (let i = 0; i < (4 - rotations) % 4; i++) after = rotate(after);
  if (result.moved) {
    state.board = after; state.score += result.gained; addRandom(state.board);
  }
  return result.moved;
}
function draw(): void {
  if (!state.boardEl || !state.statusEl) return;
  const rows = state.board.map((row) =>
    row.map((n) => (n === 0 ? '.' : String(n)).padStart(5, ' ')).join(' '),
  );
  const border = '─'.repeat(rows[0].length);
  state.boardEl.textContent = `┌${border}┐\n${rows.map((r) => `│${r}│`).join('\n')}\n└${border}┘`;
  const high = parseInt(localStorage.getItem(HIGH_KEY) || '0', 10);
  state.statusEl.textContent = `score: ${state.score}    high: ${high}    arrows to move. q to quit.`;
}
function close(): void {
  if (state.overlay) state.overlay.remove();
  state.overlay = null;
}

const prog: Program = {
  name: '2048',
  manpage: '2048 — classic. arrows. merge tiles. q to quit.',
  category: 'game',
  mode: 'modal',
  init: () => {
    state.board = empty();
    state.score = 0;
    addRandom(state.board);
    addRandom(state.board);

    state.overlay = document.createElement('div');
    state.overlay.className = 't2048-overlay';
    state.boardEl = document.createElement('pre');
    state.boardEl.className = 't2048-board';
    state.statusEl = document.createElement('div');
    state.statusEl.className = 't2048-status';
    state.overlay.append(state.boardEl, state.statusEl);
    document.body.appendChild(state.overlay);
    draw();
  },
  onKey: (_ctx, key: KeyEvent) => {
    if (key.key === 'q' || key.key === 'Escape') { close(); return; }
    if (key.key === 'ArrowLeft')  move('left');
    if (key.key === 'ArrowRight') move('right');
    if (key.key === 'ArrowUp')    move('up');
    if (key.key === 'ArrowDown')  move('down');
    const high = parseInt(localStorage.getItem(HIGH_KEY) || '0', 10);
    if (state.score > high) localStorage.setItem(HIGH_KEY, String(state.score));
    draw();
  },
  render: () => { /* event-driven */ },
  cleanup: () => close(),
};

export default prog;
