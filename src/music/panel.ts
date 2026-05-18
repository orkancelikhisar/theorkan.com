import type { MusicAPI } from './engine';

// Music panel — small floating window bottom-right. Title + caption + live
// AnalyserNode waveform + progress bar. Below it: three buttons —
//   ◀◀  scrub back  (hold)
//   ▶▶  scrub forward (hold)
//   ×   stop + close

export interface MusicPanelAPI {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

const WAVE_W = 40;
const WAVE_H = 5;
const SCRUB_STEP_S = 2;          // seconds per tick when holding
const SCRUB_TICK_MS = 80;        // tick interval while held

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function renderWaveform(analyser: AnalyserNode | null): string {
  const rows: string[][] = Array.from({ length: WAVE_H }, () => new Array(WAVE_W).fill(' '));
  if (!analyser) return rows.map((r) => r.join('')).join('\n');
  const bufLen = analyser.fftSize;
  const data = new Uint8Array(bufLen);
  analyser.getByteTimeDomainData(data);
  const step = bufLen / WAVE_W;
  const cols: number[] = [];
  for (let c = 0; c < WAVE_W; c++) {
    const start = Math.floor(c * step);
    const end = Math.floor((c + 1) * step);
    let max = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(data[i] - 128);
      if (v > max) max = v;
    }
    cols.push(max);
  }
  const peak = Math.max(...cols, 1);
  const norm = cols.map((v) => v / peak);
  for (let c = 0; c < WAVE_W; c++) {
    const h = Math.max(1, Math.round(norm[c] * (WAVE_H - 1)));
    const halfDown = Math.floor(h / 2);
    const mid = Math.floor(WAVE_H / 2);
    for (let dy = -halfDown; dy <= h - halfDown - 1; dy++) {
      const r = mid + dy;
      if (r < 0 || r >= WAVE_H) continue;
      rows[r][c] = dy === 0 ? '─' : (dy === -halfDown || dy === h - halfDown - 1 ? '·' : '|');
    }
  }
  return rows.map((row) => row.join('')).join('\n');
}

function progressBar(elapsed: number, duration: number, width = 30): string {
  const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const filled = Math.round(width * ratio);
  return `[${'■'.repeat(filled)}${'·'.repeat(width - filled)}]`;
}

export function createMusicPanel(music: MusicAPI, container: HTMLElement): MusicPanelAPI {
  const el = document.createElement('div');
  el.className = 'music-panel';

  const head = document.createElement('div');
  head.className = 'music-panel__head';

  const titleEl = document.createElement('span');
  titleEl.className = 'music-panel__title';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'music-panel__close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'stop music and close');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    music.stop();
    api.close();
  });

  head.append(titleEl, closeBtn);

  const captionEl = document.createElement('span');
  captionEl.className = 'music-panel__caption';

  const waveEl = document.createElement('pre');
  waveEl.className = 'music-panel__wave';

  const progressEl = document.createElement('span');
  progressEl.className = 'music-panel__progress';

  const ctrlRow = document.createElement('div');
  ctrlRow.className = 'music-panel__ctrl-row';

  // Hold-to-scrub: while the pointer is held, tick scrub at SCRUB_TICK_MS.
  function makeScrubBtn(label: string, ariaLabel: string, deltaS: number): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'music-panel__btn';
    b.textContent = label;
    b.setAttribute('aria-label', ariaLabel);
    let timer: number | null = null;
    function start(e: Event): void {
      e.preventDefault();
      e.stopPropagation();
      music.scrubBy(deltaS);
      timer = window.setInterval(() => music.scrubBy(deltaS), SCRUB_TICK_MS);
    }
    function stop(): void {
      if (timer != null) { clearInterval(timer); timer = null; }
    }
    b.addEventListener('mousedown', start);
    b.addEventListener('mouseup', stop);
    b.addEventListener('mouseleave', stop);
    b.addEventListener('touchstart', start, { passive: false });
    b.addEventListener('touchend', stop);
    b.addEventListener('touchcancel', stop);
    return b;
  }

  const btnRewind  = makeScrubBtn('◀◀', 'rewind (hold)', -SCRUB_STEP_S);
  const btnForward = makeScrubBtn('▶▶', 'fast-forward (hold)', SCRUB_STEP_S);
  ctrlRow.append(btnRewind, btnForward);

  el.append(head, captionEl, waveEl, progressEl, ctrlRow);
  container.appendChild(el);

  let open = false;
  let rafId: number | null = null;

  function tick(): void {
    if (!open) return;
    const cur = music.current();
    if (!cur) {
      titleEl.textContent = '(no track)';
      captionEl.textContent = '';
      waveEl.textContent = renderWaveform(null);
      progressEl.textContent = '';
    } else {
      const status = cur.paused ? ' [paused]' : '';
      titleEl.textContent = `♪ ${cur.track.title}${status}`;
      captionEl.textContent = cur.track.caption ?? '';
      waveEl.textContent = renderWaveform(music.getAnalyser());
      progressEl.textContent = `${progressBar(cur.elapsed, cur.duration)}  ${fmtTime(cur.elapsed)} / ${fmtTime(cur.duration)}`;
    }
    rafId = requestAnimationFrame(tick);
  }

  const api: MusicPanelAPI = {
    open() {
      if (open) return;
      open = true;
      el.classList.add('is-open');
      rafId = requestAnimationFrame(tick);
    },
    close() {
      open = false;
      el.classList.remove('is-open');
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    },
    isOpen: () => open,
  };
  return api;
}
