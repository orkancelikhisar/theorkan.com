import './regatta.css';
import type { Program, KeyEvent } from '../../../kernel/program';
import { initialState, type RegattaState } from './state';
import { updateRegatta } from './update';
import { RegattaRenderer } from './render';

interface Active {
  overlay: HTMLElement;
  canvas: HTMLCanvasElement;
  tutorial: HTMLElement | null;
  state: RegattaState;
  renderer: RegattaRenderer;
  raf: number;
  lastFrameMs: number;
  paused: boolean;
}

let active: Active | null = null;

function tutorialEl(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'regatta-tutorial';
  el.textContent = [
    'the wind is from the northeast. you cannot sail directly into it.',
    'to go north, you must tack — zigzag, alternating sides.',
    'your sail is the engine. trim it to roughly half the wind angle.',
    '',
    '←  →  rudder.    ↑  ↓  sail.    space pause / start.    q quit.',
    '',
    'press space to start.',
  ].join('\n');
  return el;
}

function frame(now: number): void {
  if (!active) return;
  const dt = Math.min(50, now - active.lastFrameMs);
  active.lastFrameMs = now;
  if (!active.paused && !active.state.showTutorial) {
    updateRegatta(active.state, now, dt);
  }
  active.renderer.draw(active.state, dt);
  active.raf = requestAnimationFrame(frame);
}

function close(): void {
  if (!active) return;
  cancelAnimationFrame(active.raf);
  active.overlay.remove();
  if (active.tutorial) active.tutorial.remove();
  active = null;
}

const prog: Program = {
  name: 'regatta',
  manpage: 'regatta — single-handed dinghy. real sailing physics. tribute to the 2024 arkas aegean.',
  category: 'game',
  mode: 'modal',
  init: () => {
    const overlay = document.createElement('div');
    overlay.className = 'regatta-overlay';
    const canvas = document.createElement('canvas');
    canvas.className = 'regatta-canvas';
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    const renderer = new RegattaRenderer(canvas);
    const state = initialState(performance.now());

    const tutorial = tutorialEl();
    document.body.appendChild(tutorial);

    active = {
      overlay, canvas, tutorial, state, renderer,
      raf: 0, lastFrameMs: performance.now(), paused: false,
    };
    active.raf = requestAnimationFrame(frame);
  },
  onKey: (_ctx, key: KeyEvent) => {
    if (!active) return;
    if (key.key === 'q' || key.key === 'Escape') { close(); return; }

    if (active.state.showTutorial) {
      if (key.key === ' ' || key.key === 'Spacebar') {
        active.state.showTutorial = false;
        active.state.startMs = performance.now();
        active.tutorial?.remove();
        active.tutorial = null;
      }
      return;
    }

    if (key.key === ' ' || key.key === 'Spacebar') { active.paused = !active.paused; return; }

    if (key.key === 'ArrowLeft')  active.state.rudderIntent = -1;
    if (key.key === 'ArrowRight') active.state.rudderIntent = 1;
    if (key.key === 'ArrowUp')    active.state.sailIntent = 1;
    if (key.key === 'ArrowDown')  active.state.sailIntent = -1;
  },
  render: () => { /* RAF-driven in frame() */ },
  cleanup: () => close(),
};

window.addEventListener('keyup', (e) => {
  if (!active) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') active.state.rudderIntent = 0;
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') active.state.sailIntent = 0;
});

export default prog;
