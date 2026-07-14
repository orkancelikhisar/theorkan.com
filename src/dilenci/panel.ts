import './dilenci.css';
import { renderDilenciEye, type DilenciEyeState } from './eye';

const PREFIXES = [
  '† he stirred †',
  '† something shifted †',
  '† the corner moved †',
  '~ postmodern_dilenci ~',
  '~ a process is awake ~',
  '~ from the archive ~',
  '· he returned ·',
  '· he asks ·',
  '· a small noise ·',
  '† the lamp moved †',
  '~ ledger touched ~',
  '· something in /var ·',
];

export type DilenciExpression = 'default' | 'alert' | 'happy' | 'sad' | 'thinking';

export interface DilenciPanelAPI {
  open(line: string, hint?: string): void;
  close(): void;
  setLine(line: string, hint?: string): void;
  setExpression(state: DilenciExpression): void;
  isOpen(): boolean;
  destroy(): void;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createDilenciPanel(container: HTMLElement): DilenciPanelAPI {
  const el = document.createElement('div');
  el.className = 'dilenci-panel';
  el.setAttribute('aria-live', 'polite');

  const prefixEl = document.createElement('span');
  prefixEl.className = 'dilenci-panel__prefix';

  const eyeEl = document.createElement('pre');
  eyeEl.className = 'dilenci-panel__eye-art';
  eyeEl.setAttribute('aria-hidden', 'true');

  const lineEl = document.createElement('span');
  lineEl.className = 'dilenci-panel__line';

  const hintEl = document.createElement('span');
  hintEl.className = 'dilenci-panel__hint';

  const thinkingEl = document.createElement('span');
  thinkingEl.className = 'dilenci-panel__thinking';
  thinkingEl.textContent = '...';

  el.append(prefixEl, eyeEl, thinkingEl, lineEl, hintEl);
  container.appendChild(el);

  const eyeState: DilenciEyeState = { lookX: 0, lookY: 0, blink: 0, dilation: 1 };
  let open = false;
  let expression: DilenciExpression = 'default';
  let blinkTimer: number | null = null;
  let thinkingTicker: number | null = null;
  let mouseHandler: ((e: MouseEvent) => void) | null = null;
  let rafQueued = false;

  function paint(): void {
    rafQueued = false;
    eyeEl.textContent = renderDilenciEye(eyeState);
  }

  function schedulePaint(): void {
    if (rafQueued) return;
    rafQueued = true;
    requestAnimationFrame(paint);
  }

  function attachCursorTracking(): void {
    if (mouseHandler) return;
    mouseHandler = (e: MouseEvent) => {
      // Where is the eye, right now? Use the actual pre-element rect so the
      // pupil tracks correctly even after the panel re-flows.
      const rect = eyeEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // Normalize over a generous radius so motion is responsive but bounded.
      const norm = 320;
      eyeState.lookX = clamp(dx / norm, -1, 1);
      eyeState.lookY = clamp(dy / norm, -1, 1);
      schedulePaint();
    };
    document.addEventListener('mousemove', mouseHandler, { passive: true });
  }

  function detachCursorTracking(): void {
    if (mouseHandler) {
      document.removeEventListener('mousemove', mouseHandler);
      mouseHandler = null;
    }
  }

  function blinkOnce(): void {
    // Frame timing: 0 → 0.4 → 0.8 → 1.0 → 1.0 → 0.6 → 0.2 → 0.
    const frames = [0.4, 0.8, 1.0, 1.0, 0.6, 0.2, 0];
    let i = 0;
    const id = window.setInterval(() => {
      eyeState.blink = frames[i++];
      schedulePaint();
      if (i >= frames.length) clearInterval(id);
    }, 32);
  }

  function scheduleBlink(): void {
    if (blinkTimer != null) clearTimeout(blinkTimer);
    const wait = expression === 'thinking'
      ? 700 + Math.random() * 900           // fast, restless
      : 3_400 + Math.random() * 4_600;      // calm, natural
    blinkTimer = window.setTimeout(() => {
      if (open) blinkOnce();
      scheduleBlink();
    }, wait);
  }

  function stopThinkingTicker(): void {
    if (thinkingTicker != null) { clearInterval(thinkingTicker); thinkingTicker = null; }
  }

  function applyExpression(): void {
    el.classList.remove('dilenci-panel--alert', 'dilenci-panel--happy', 'dilenci-panel--sad', 'dilenci-panel--thinking');
    if (expression !== 'default') el.classList.add(`dilenci-panel--${expression}`);
    switch (expression) {
      case 'alert':    eyeState.dilation = 1.2; eyeState.blink = 0; break;
      case 'happy':    eyeState.dilation = 0.8; eyeState.blink = 0.6; break;
      case 'sad':      eyeState.dilation = 0.9; eyeState.blink = 0.4; eyeState.lookY = 0.6; break;
      case 'thinking': eyeState.dilation = 1.0; eyeState.blink = 0; break;
      default:         eyeState.dilation = 1.0; eyeState.blink = 0; break;
    }
    schedulePaint();
    stopThinkingTicker();
    if (expression === 'thinking') {
      const ticker = ['.  ', '.. ', '...', ' ..', '  .'];
      let idx = 0;
      thinkingEl.textContent = ticker[0];
      thinkingTicker = window.setInterval(() => {
        idx = (idx + 1) % ticker.length;
        thinkingEl.textContent = ticker[idx];
      }, 220);
    }
  }

  function pickPrefix(): string {
    return PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  }

  return {
    open(line, hint) {
      prefixEl.textContent = pickPrefix();
      lineEl.textContent = line;
      hintEl.textContent = hint ?? '';
      expression = 'default';
      eyeState.lookX = 0; eyeState.lookY = 0; eyeState.blink = 0; eyeState.dilation = 1;
      applyExpression();
      requestAnimationFrame(() => el.classList.add('is-open'));
      open = true;
      attachCursorTracking();
      scheduleBlink();
    },
    setLine(line, hint) {
      lineEl.textContent = line;
      hintEl.textContent = hint ?? '';
    },
    setExpression(state) {
      expression = state;
      applyExpression();
    },
    close() {
      el.classList.remove('is-open');
      open = false;
      detachCursorTracking();
      if (blinkTimer != null) { clearTimeout(blinkTimer); blinkTimer = null; }
      stopThinkingTicker();
    },
    isOpen() { return open; },
    destroy() {
      this.close();
      el.remove();
    },
  };
}
