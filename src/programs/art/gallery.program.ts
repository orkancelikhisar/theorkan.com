import './gallery.css';
import type { Program, KeyEvent } from '../../kernel/program';
import { WORKS, type GalleryWork } from './gallery-works';

// gallery — browse Orkan's works. Modal overlay; arrow keys navigate.
// Works can be static (a single ASCII string) or animated (a frames array
// from `scripts/video-to-ascii.ts`). Animated works play at their fps.

let overlay: HTMLDivElement | null = null;
let artEl: HTMLPreElement | null = null;
let titleEl: HTMLSpanElement | null = null;
let captionEl: HTMLSpanElement | null = null;
let counterEl: HTMLSpanElement | null = null;
let index = 0;
let frameTimer: number | null = null;
let frameIdx = 0;
let frameDir: 1 | -1 = 1;

function stopFrameLoop(): void {
  if (frameTimer != null) { clearInterval(frameTimer); frameTimer = null; }
}

function showStatic(w: GalleryWork): void {
  if (!artEl) return;
  artEl.textContent = (w.art ?? '').replace(/^\n/, '');
}

function showFrames(w: GalleryWork): void {
  if (!artEl || !w.frames || w.frames.length === 0) return;
  frameIdx = 0;
  frameDir = 1;
  artEl.textContent = w.frames[0];
  const fps = w.fps ?? 30;
  const interval = Math.max(33, Math.round(1000 / fps));
  // Ping-pong: forward to last frame, then reverse to first, repeat. This
  // makes every clip loop seamlessly regardless of how the source ended.
  // Doubles effective duration but only at playback time — no extra storage.
  frameTimer = window.setInterval(() => {
    if (!artEl || !w.frames) return;
    const last = w.frames.length - 1;
    if (last <= 0) return;
    frameIdx += frameDir;
    if (frameIdx >= last) { frameIdx = last; frameDir = -1; }
    else if (frameIdx <= 0) { frameIdx = 0; frameDir = 1; }
    artEl.textContent = w.frames[frameIdx];
  }, interval);
}

async function ensureLoaded(w: GalleryWork): Promise<void> {
  if (!w.isVideo || w.frames) return;
  if (!w.loader) return;
  const loaded = await w.loader();
  // Mutate the same object so we don't re-fetch on the next visit.
  w.title = loaded.title;
  w.year = loaded.year;
  w.caption = loaded.caption;
  w.fps = loaded.fps;
  w.frames = loaded.frames;
}

let renderToken = 0;
async function render(): Promise<void> {
  stopFrameLoop();
  const token = ++renderToken;
  const w = WORKS[index];
  if (!artEl || !titleEl || !captionEl || !counterEl) return;
  titleEl.textContent = `${w.title} (${w.year})`;
  captionEl.textContent = w.caption;
  counterEl.textContent = `${String(index + 1).padStart(2, '0')} / ${String(WORKS.length).padStart(2, '0')}`;

  if (w.isVideo && !w.frames) {
    artEl.textContent = '\n\n  loading…\n';
    try { await ensureLoaded(w); }
    catch (e) { artEl.textContent = `\n\n  could not load: ${(e as Error).message}\n`; return; }
    if (token !== renderToken) return;          // user navigated away; abandon
    titleEl.textContent = `${w.title} (${w.year})`;
    captionEl.textContent = w.caption;
  }

  if (w.frames && w.frames.length) showFrames(w);
  else showStatic(w);
}

function close(): void {
  stopFrameLoop();
  if (overlay) overlay.remove();
  overlay = null;
  artEl = null; titleEl = null; captionEl = null; counterEl = null;
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
    void render();
    // Pre-fetch every video work in the background and apply the result to
    // the work object so subsequent navigation is instant. Runs in parallel.
    for (const w of WORKS) if (w.isVideo && !w.frames) void ensureLoaded(w);
  },
  onKey: (_ctx, e: KeyEvent) => {
    if (!overlay) return;
    if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'h') {
      index = (index - 1 + WORKS.length) % WORKS.length;
      void render();
    } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === ' ') {
      index = (index + 1) % WORKS.length;
      void render();
    }
  },
  render: () => {},
  cleanup: () => close(),
};

export default prog;
