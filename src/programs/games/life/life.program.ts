import './life.css';
import type { Program, KeyEvent } from '../../../kernel/program';
import { emptyBoard, lifeStep, randomize, PRESETS, type Board } from './life-step';

const W = 50, H = 24;

interface GameState {
  board: Board;
  playing: boolean;
  generation: number;
  cursor: { x: number; y: number };
  overlay: HTMLElement | null;
  boardEl: HTMLElement | null;
  statusEl: HTMLElement | null;
  loop: number | null;
}

const state: GameState = {
  board: emptyBoard(W, H),
  playing: false,
  generation: 0,
  cursor: { x: 25, y: 12 },
  overlay: null,
  boardEl: null,
  statusEl: null,
  loop: null,
};

function draw(): void {
  if (!state.boardEl || !state.statusEl) return;
  const rows: string[] = [];
  for (let r = 0; r < H; r++) {
    let line = '';
    for (let c = 0; c < W; c++) {
      const isCursor = !state.playing && c === state.cursor.x && r === state.cursor.y;
      if (state.board[r][c]) line += isCursor ? '◉' : '●';
      else                   line += isCursor ? '·' : ' ';
    }
    rows.push(line);
  }
  const border = '─'.repeat(W);
  state.boardEl.textContent = `┌${border}┐\n${rows.map((row) => `│${row}│`).join('\n')}\n└${border}┘`;
  state.statusEl.textContent = state.playing
    ? `playing. gen ${state.generation}. p pause. r random. c clear. q quit.`
    : `paused. arrows move. space place. p play. r random. c clear. g glider. q quit.`;
}

function tick(): void {
  state.board = lifeStep(state.board);
  state.generation += 1;
  draw();
}

function close(): void {
  if (state.overlay) state.overlay.remove();
  state.overlay = null;
  if (state.loop != null) window.clearInterval(state.loop);
  state.loop = null;
}

function placePreset(name: keyof typeof PRESETS, offX: number, offY: number): void {
  const cells = PRESETS[name];
  if (!cells) return;
  for (const [dr, dc] of cells) {
    const r = (offY + dr + H) % H;
    const c = (offX + dc + W) % W;
    state.board[r][c] = 1;
  }
}

const prog: Program = {
  name: 'life',
  manpage: "life — conway's game of life. arrows move cursor, space place/play, r randomize, c clear, g glider, q quit.",
  category: 'game',
  mode: 'modal',
  init: () => {
    state.board = emptyBoard(W, H);
    state.playing = false;
    state.generation = 0;
    state.cursor = { x: 25, y: 12 };

    state.overlay = document.createElement('div');
    state.overlay.className = 'life-overlay';
    state.boardEl = document.createElement('pre');
    state.boardEl.className = 'life-board';
    state.statusEl = document.createElement('div');
    state.statusEl.className = 'life-status';
    state.overlay.append(state.boardEl, state.statusEl);
    document.body.appendChild(state.overlay);

    draw();
  },
  onKey: (_ctx, key: KeyEvent) => {
    if (key.key === 'q' || key.key === 'Escape') { close(); return; }

    if (state.playing) {
      if (key.key === 'p' || key.key === 'P') {
        state.playing = false;
        if (state.loop != null) window.clearInterval(state.loop);
        state.loop = null;
        draw();
      }
      return;
    }

    if (key.key === 'ArrowUp')    state.cursor.y = (state.cursor.y - 1 + H) % H;
    if (key.key === 'ArrowDown')  state.cursor.y = (state.cursor.y + 1) % H;
    if (key.key === 'ArrowLeft')  state.cursor.x = (state.cursor.x - 1 + W) % W;
    if (key.key === 'ArrowRight') state.cursor.x = (state.cursor.x + 1) % W;
    if (key.key === ' ' || key.key === 'Spacebar') {
      // toggle the cell under the cursor — does NOT start the simulation.
      state.board[state.cursor.y][state.cursor.x] = 1 - state.board[state.cursor.y][state.cursor.x];
    }
    if (key.key === 'p' || key.key === 'P') {
      const anyAlive = state.board.some((row) => row.some((v) => v));
      if (anyAlive) {
        state.playing = true;
        state.loop = window.setInterval(tick, 150);
      }
    }
    if (key.key === 'r' || key.key === 'R') { randomize(state.board); state.generation = 0; }
    if (key.key === 'c' || key.key === 'C') { state.board = emptyBoard(W, H); state.generation = 0; }
    if (key.key === 'g' || key.key === 'G') { placePreset('glider', state.cursor.x, state.cursor.y); }
    draw();
  },
  render: () => {},
  cleanup: () => close(),
};

export default prog;
