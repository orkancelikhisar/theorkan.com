import './dilenci.css';

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

// Eye states are a single grapheme each. The "drift" letters are pulled from
// fragments of poems orkan once half-wrote, so each blink shows a different
// scrap of language briefly before settling back to a dot.
const EYE_DEFAULT = '●';
const EYE_HAPPY = '^';
const EYE_SAD = '·';
const EYE_ALERT = '◉';
const DRIFT_LETTERS = ['a', 'e', 'i', 'o', 'u', 'r', 's', 'l', 'n', 'm', 't'];

export type DilenciExpression = 'default' | 'alert' | 'happy' | 'sad';

export interface DilenciPanelAPI {
  open(line: string, hint?: string): void;
  close(): void;
  setLine(line: string, hint?: string): void;
  setExpression(state: DilenciExpression): void;
  isOpen(): boolean;
  destroy(): void;
}

export function createDilenciPanel(container: HTMLElement): DilenciPanelAPI {
  const el = document.createElement('div');
  el.className = 'dilenci-panel';
  el.setAttribute('aria-live', 'polite');

  const prefixEl = document.createElement('span');
  prefixEl.className = 'dilenci-panel__prefix';

  const faceEl = document.createElement('div');
  faceEl.className = 'dilenci-panel__face';
  const leftEye = document.createElement('span');
  leftEye.className = 'dilenci-panel__eye';
  leftEye.textContent = EYE_DEFAULT;
  const rightEye = document.createElement('span');
  rightEye.className = 'dilenci-panel__eye';
  rightEye.textContent = EYE_DEFAULT;
  faceEl.append(leftEye, rightEye);

  const lineEl = document.createElement('span');
  lineEl.className = 'dilenci-panel__line';

  const hintEl = document.createElement('span');
  hintEl.className = 'dilenci-panel__hint';

  el.append(prefixEl, faceEl, lineEl, hintEl);
  container.appendChild(el);

  let open = false;
  let expression: DilenciExpression = 'default';
  let blinkTimer: number | null = null;
  let driftTimer: number | null = null;

  function glyphFor(state: DilenciExpression): string {
    switch (state) {
      case 'alert':   return EYE_ALERT;
      case 'happy':   return EYE_HAPPY;
      case 'sad':     return EYE_SAD;
      default:        return EYE_DEFAULT;
    }
  }

  function setEyeGlyph(g: string): void {
    leftEye.textContent = g;
    rightEye.textContent = g;
  }

  function blinkOnce(): void {
    leftEye.classList.add('is-blink');
    rightEye.classList.add('is-blink');
    window.setTimeout(() => {
      leftEye.classList.remove('is-blink');
      rightEye.classList.remove('is-blink');
    }, 130);
  }

  function scheduleBlink(): void {
    if (blinkTimer != null) clearTimeout(blinkTimer);
    blinkTimer = window.setTimeout(() => {
      if (open) blinkOnce();
      scheduleBlink();
    }, 3_500 + Math.random() * 4_500);
  }

  function scheduleDrift(): void {
    if (driftTimer != null) clearTimeout(driftTimer);
    driftTimer = window.setTimeout(() => {
      if (open && expression === 'default') {
        // Briefly show a fragment-letter in one eye, like a passing thought.
        const which = Math.random() < 0.5 ? leftEye : rightEye;
        const letter = DRIFT_LETTERS[Math.floor(Math.random() * DRIFT_LETTERS.length)];
        const original = which.textContent;
        which.textContent = letter;
        faceEl.classList.add('is-drift');
        window.setTimeout(() => {
          which.textContent = original;
          faceEl.classList.remove('is-drift');
        }, 700);
      }
      scheduleDrift();
    }, 8_000 + Math.random() * 9_000);
  }

  function applyExpression(): void {
    faceEl.classList.remove('is-alert', 'is-happy', 'is-sad');
    if (expression === 'alert') faceEl.classList.add('is-alert');
    else if (expression === 'happy') faceEl.classList.add('is-happy');
    else if (expression === 'sad') faceEl.classList.add('is-sad');
    setEyeGlyph(glyphFor(expression));
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
      applyExpression();
      requestAnimationFrame(() => el.classList.add('is-open'));
      open = true;
      scheduleBlink();
      scheduleDrift();
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
      if (blinkTimer != null) { clearTimeout(blinkTimer); blinkTimer = null; }
      if (driftTimer != null) { clearTimeout(driftTimer); driftTimer = null; }
    },
    isOpen() { return open; },
    destroy() {
      this.close();
      el.remove();
    },
  };
}
