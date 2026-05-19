import './snake.css';
import type { Program, KeyEvent } from '../../../kernel/program';

const W = 28, H = 16;
const HIGH_KEY = 'theorkan.snake.high';

interface Pos { x: number; y: number; }

interface GameState {
  snake: Pos[];
  dir: Pos;
  apple: Pos;
  bonus: Pos | null;
  score: number;
  alive: boolean;
  loop: number | null;
  overlay: HTMLElement | null;
  board: HTMLElement | null;
  status: HTMLElement | null;
}

const state: GameState = {
  snake: [],
  dir: { x: 1, y: 0 },
  apple: { x: 0, y: 0 },
  bonus: null,
  score: 0,
  alive: true,
  loop: null,
  overlay: null,
  board: null,
  status: null,
};

function placeApple(): void {
  for (let i = 0; i < 100; i++) {
    const a = { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) };
    if (!state.snake.find((s) => s.x === a.x && s.y === a.y)) { state.apple = a; return; }
  }
}

function draw(): void {
  if (!state.board || !state.status) return;
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      const isHead = state.snake[0]?.x === x && state.snake[0]?.y === y;
      const isBody = state.snake.slice(1).find((s) => s.x === x && s.y === y);
      const isApple = state.apple.x === x && state.apple.y === y;
      const isBonus = state.bonus && state.bonus.x === x && state.bonus.y === y;
      if (isHead) line += '●';
      else if (isBody) line += '○';
      else if (isApple) line += '·';
      else if (isBonus) line += '*';
      else line += ' ';
    }
    rows.push(line);
  }
  const border = '─'.repeat(W);
  state.board.textContent = `┌${border}┐\n${rows.map((r) => `│${r}│`).join('\n')}\n└${border}┘`;
  state.status.textContent = state.alive
    ? `score: ${state.score}    high: ${localStorage.getItem(HIGH_KEY) || 0}    arrows to move. q to quit.`
    : `dead. score ${state.score}. press q to leave.`;
}

function tick(): void {
  if (!state.alive) return;
  if (document.hidden) return;          // skip work while tab is backgrounded
  const head = { ...state.snake[0] };
  head.x = (head.x + state.dir.x + W) % W;
  head.y = (head.y + state.dir.y + H) % H;
  if (state.snake.find((s) => s.x === head.x && s.y === head.y)) {
    state.alive = false;
    const high = parseInt(localStorage.getItem(HIGH_KEY) || '0', 10);
    if (state.score > high) localStorage.setItem(HIGH_KEY, String(state.score));
    if (state.loop != null) window.clearInterval(state.loop);
    state.loop = null;
    draw();
    return;
  }
  state.snake.unshift(head);
  if (head.x === state.apple.x && head.y === state.apple.y) {
    state.score += 1;
    placeApple();
    if (state.score > 0 && state.score % 5 === 0) {
      state.bonus = { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) };
    }
  } else if (state.bonus && head.x === state.bonus.x && head.y === state.bonus.y) {
    state.score += 3;
    state.bonus = null;
  } else {
    state.snake.pop();
  }
  draw();
}

function close(): void {
  if (state.overlay) state.overlay.remove();
  state.overlay = null;
  if (state.loop != null) window.clearInterval(state.loop);
  state.loop = null;
}

const prog: Program = {
  name: 'snake',
  manpage: 'snake — classic. arrows move. q to quit. dying on a bonus matters.',
  category: 'game',
  mode: 'modal',
  init: () => {
    state.snake = [{ x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }];
    state.dir = { x: 1, y: 0 };
    state.score = 0;
    state.alive = true;
    state.bonus = null;
    placeApple();

    state.overlay = document.createElement('div');
    state.overlay.className = 'snake-overlay';
    state.board = document.createElement('pre');
    state.board.className = 'snake-board';
    state.status = document.createElement('div');
    state.status.className = 'snake-status';
    state.overlay.append(state.board, state.status);
    document.body.appendChild(state.overlay);

    state.loop = window.setInterval(() => tick(), 130);
    draw();
  },
  onKey: (_ctx, key: KeyEvent) => {
    if (key.key === 'q' || key.key === 'Escape') { close(); return; }
    if (!state.alive) return;
    if (key.key === 'ArrowUp' && state.dir.y !== 1)    state.dir = { x: 0, y: -1 };
    if (key.key === 'ArrowDown' && state.dir.y !== -1) state.dir = { x: 0, y: 1 };
    if (key.key === 'ArrowLeft' && state.dir.x !== 1)  state.dir = { x: -1, y: 0 };
    if (key.key === 'ArrowRight' && state.dir.x !== -1) state.dir = { x: 1, y: 0 };
  },
  render: () => { /* event-driven via interval */ },
  cleanup: () => close(),
};

export default prog;
