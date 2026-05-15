import './regatta.css';
import type { Program } from '../../../kernel/program';

// The regatta game lives as a static asset at public/games/regatta.html.
// This program opens a full-viewport overlay with that file in an iframe,
// keeping the OS shell experience intact (no new browser window).

let overlay: HTMLDivElement | null = null;
let escListener: ((e: KeyboardEvent) => void) | null = null;

function close(): void {
  if (overlay) overlay.remove();
  overlay = null;
  if (escListener) {
    window.removeEventListener('keydown', escListener, true);
    escListener = null;
  }
}

const prog: Program = {
  name: 'regatta',
  manpage: 'regatta — single-handed sailing simulator. ← → steer, ↑ ↓ mainsheet. esc/× to quit.',
  category: 'game',
  mode: 'modal',
  init: () => {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'regatta-overlay';

    const iframe = document.createElement('iframe');
    iframe.className = 'regatta-iframe';
    iframe.src = 'games/regatta.html';
    iframe.title = 'regatta';
    overlay.appendChild(iframe);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'regatta-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '× quit';
    closeBtn.title = 'quit (esc)';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });
    overlay.appendChild(closeBtn);

    document.body.appendChild(overlay);

    // Give the iframe focus so arrow keys reach the game immediately.
    iframe.addEventListener('load', () => {
      try { iframe.contentWindow?.focus(); } catch { /* ignore */ }
    });

    // Listen for Esc at the capture phase. The iframe's own keydown handler
    // doesn't intercept Esc (game uses arrows only), so this works regardless
    // of whether focus is in the parent or the iframe.
    escListener = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', escListener, true);
  },
  // The iframe handles its own input. These stubs satisfy the modal contract
  // tested in registry.test.ts; the kernel's modal key-router calls them as
  // no-ops while the iframe has focus.
  onKey: () => { /* no-op — keys flow into the iframe */ },
  render: () => { /* no-op — iframe drives its own RAF loop */ },
  cleanup: () => close(),
};

export default prog;
