import type { MusicAPI } from './engine';

// Music panel — a small floating element bottom-right of the void. Renders
// title, ASCII waveform from the AnalyserNode, and a progress bar. Updates
// itself via rAF; closes when stop is called.

export interface MusicPanelAPI {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

const WAVEFORM_W = 40;
const WAVEFORM_H = 5;

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function renderWaveform(analyser: AnalyserNode | null): string {
  if (!analyser) {
    return new Array(WAVEFORM_H).fill(' '.repeat(WAVEFORM_W)).join('\n');
  }
  const bufLen = analyser.fftSize;
  const data = new Uint8Array(bufLen);
  analyser.getByteTimeDomainData(data);
  // Reduce to W columns by averaging slices.
  const step = bufLen / WAVEFORM_W;
  const cols: number[] = [];
  for (let c = 0; c < WAVEFORM_W; c++) {
    const start = Math.floor(c * step);
    const end = Math.floor((c + 1) * step);
    let max = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(data[i] - 128);
      if (v > max) max = v;
    }
    cols.push(max);                  // 0..127
  }
  const peak = Math.max(...cols, 1);
  const norm = cols.map((v) => v / peak);
  // Render as vertical bars, centered.
  const rows: string[][] = Array.from({ length: WAVEFORM_H }, () => new Array(WAVEFORM_W).fill(' '));
  for (let c = 0; c < WAVEFORM_W; c++) {
    const h = Math.max(1, Math.round(norm[c] * (WAVEFORM_H - 1)));
    const halfDown = Math.floor(h / 2);
    const mid = Math.floor(WAVEFORM_H / 2);
    for (let dy = -halfDown; dy <= h - halfDown - 1; dy++) {
      const r = mid + dy;
      if (r < 0 || r >= WAVEFORM_H) continue;
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

  const titleEl = document.createElement('span');
  titleEl.className = 'music-panel__title';

  const captionEl = document.createElement('span');
  captionEl.className = 'music-panel__caption';

  const waveEl = document.createElement('pre');
  waveEl.className = 'music-panel__wave';

  const progressEl = document.createElement('span');
  progressEl.className = 'music-panel__progress';

  const ctrlEl = document.createElement('span');
  ctrlEl.className = 'music-panel__ctrl';
  ctrlEl.textContent = 'music pause / skip / stop';

  el.append(titleEl, captionEl, waveEl, progressEl, ctrlEl);
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

  return {
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
}
