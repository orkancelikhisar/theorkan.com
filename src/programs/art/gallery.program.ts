import './gallery.css';
import type { Program, KeyEvent } from '../../kernel/program';
import { WORKS } from './gallery-works';

// gallery — browse Orkan's works. Modal overlay; arrow keys navigate; q/esc
// quits. Title + year + caption beneath the piece.

let overlay: HTMLDivElement | null = null;
let artEl: HTMLPreElement | null = null;
let titleEl: HTMLSpanElement | null = null;
let captionEl: HTMLSpanElement | null = null;
let counterEl: HTMLSpanElement | null = null;
let index = 0;

function render(): void {
  const w = WORKS[index];
  if (!artEl || !titleEl || !captionEl || !counterEl) return;
  artEl.textContent = w.art.replace(/^\n/, '');
  titleEl.textContent = `${w.title} (${w.year})`;
  captionEl.textContent = w.caption;
  counterEl.textContent = `${String(index + 1).padStart(2, '0')} / ${String(WORKS.length).padStart(2, '0')}`;
}

function close(): void {
  if (overlay) overlay.remove();
  overlay = null;
  artEl = null; titleEl = null; captionEl = null; counterEl = null;
  // Return focus to terminal — same fix as regatta.
  const input = document.querySelector('.terminal__input');
  if (input instanceof HTMLElement) input.focus();
}

const prog: Program = {
  name: 'gallery',
  manpage: 'gallery — browse orkan\'s ascii works. ← → navigate, q / esc quit.',
  category: 'art',
  mode: 'modal',
  init: () => {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'gallery-overlay';

    const frame = document.createElement('div');
    frame.className = 'gallery-frame';

    const chrome = document.createElement('div');
    chrome.className = 'gallery-frame__chrome';
    counterEl = document.createElement('span');
    counterEl.textContent = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'gallery-frame__close';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'close gallery');
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    chrome.append(counterEl, closeBtn);
    frame.appendChild(chrome);

    artEl = document.createElement('pre');
    artEl.className = 'gallery-frame__art';
    frame.appendChild(artEl);

    const meta = document.createElement('div');
    meta.className = 'gallery-frame__meta';
    titleEl = document.createElement('span');
    titleEl.className = 'gallery-frame__title';
    captionEl = document.createElement('span');
    captionEl.className = 'gallery-frame__caption';
    meta.append(titleEl, captionEl);
    frame.appendChild(meta);

    const hint = document.createElement('div');
    hint.className = 'gallery-frame__hint';
    hint.textContent = '← prev   → next   q / esc quit';
    frame.appendChild(hint);

    overlay.appendChild(frame);
    document.body.appendChild(overlay);

    index = 0;
    render();
  },
  onKey: (_ctx, e: KeyEvent) => {
    if (!overlay) return;
    if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'h') {
      index = (index - 1 + WORKS.length) % WORKS.length;
      render();
    } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === ' ') {
      index = (index + 1) % WORKS.length;
      render();
    }
  },
  render: () => {},
  cleanup: () => close(),
};

export default prog;
