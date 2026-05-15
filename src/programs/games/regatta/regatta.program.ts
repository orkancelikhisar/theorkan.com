import './regatta.css';
import type { Program } from '../../../kernel/program';

// The regatta game lives as a static asset at public/games/regatta.html.
// This program opens a centered window containing that file in an iframe,
// matching how the other modal games (snake, life, 2048) present.

let overlay: HTMLDivElement | null = null;
let escListener: ((e: KeyboardEvent) => void) | null = null;
let msgListener: ((e: MessageEvent) => void) | null = null;

function close(): void {
  if (overlay) overlay.remove();
  overlay = null;
  if (escListener) {
    window.removeEventListener('keydown', escListener, true);
    escListener = null;
  }
  if (msgListener) {
    window.removeEventListener('message', msgListener);
    msgListener = null;
  }
}

const prog: Program = {
  name: 'regatta',
  manpage: 'regatta — single-handed sailing simulator. ← → steer, ↑ ↓ mainsheet. q or × to quit.',
  category: 'game',
  mode: 'modal',
  init: () => {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'regatta-overlay';

    const win = document.createElement('div');
    win.className = 'regatta-window';

    const iframe = document.createElement('iframe');
    iframe.className = 'regatta-iframe';
    iframe.src = 'games/regatta.html';
    iframe.title = 'regatta';
    win.appendChild(iframe);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'regatta-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '× quit';
    closeBtn.title = 'quit (q / esc)';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });
    win.appendChild(closeBtn);

    overlay.appendChild(win);
    document.body.appendChild(overlay);

    iframe.addEventListener('load', () => {
      try { iframe.contentWindow?.focus(); } catch { /* ignore */ }
    });

    // Backup quit when focus is on the parent (e.g. user clicked the chrome).
    escListener = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', escListener, true);

    // Primary quit path — the game posts 'regatta:quit' on Q/Esc from inside.
    msgListener = (e: MessageEvent): void => {
      if (e.data === 'regatta:quit') close();
    };
    window.addEventListener('message', msgListener);
  },
  onKey: () => { /* iframe owns its own keys */ },
  render: () => { /* iframe drives its own RAF */ },
  cleanup: () => close(),
};

export default prog;
