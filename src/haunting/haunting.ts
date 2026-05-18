import './haunting.css';
import phrases from '../content/haunting-phrases.json';
import { boostWhispers } from '../void/whisper-engine';

// haunting — ambient, restrained. Every 3–7 minutes a phrase appears at
// the margins of the viewport in dim bone-white, holds for ~8 seconds,
// then fades out. There is no interaction, no audio, no event hook —
// the visitor either notices or they don't. That's the point.
//
// The daemon respects document visibility: when the tab is hidden, the
// next firing is deferred so phrases don't pile up while no one's looking.

const MIN_DELAY_MS = 3 * 60 * 1000;
const MAX_DELAY_MS = 7 * 60 * 1000;
// The very first firing in a fresh session is sooner: a visitor who never
// stays past ~3 minutes would never know the atmosphere exists otherwise.
const FIRST_MIN_DELAY_MS = 60_000;
const FIRST_MAX_DELAY_MS = 150_000;
const HOLD_MS      = 8_000;             // visible duration
const FADE_OUT_MS  = 3_500;             // matches haunting.css transition

type Side = 'top' | 'bottom' | 'left' | 'right';

export interface HauntingAPI {
  stop(): void;
  // For tests / dev: surface a phrase now.
  fireOnce(phrase?: string, side?: Side): void;
}

export function pickDelay(rng = Math.random): number {
  return MIN_DELAY_MS + rng() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

export function pickFirstDelay(rng = Math.random): number {
  return FIRST_MIN_DELAY_MS + rng() * (FIRST_MAX_DELAY_MS - FIRST_MIN_DELAY_MS);
}

export function pickPhrase(rng = Math.random): string {
  return phrases[Math.floor(rng() * phrases.length)];
}

export function pickSide(rng = Math.random): Side {
  // Weighted: top/bottom get the long phrases; left/right are rarer and
  // mostly for the very short ones. Bottom slightly favored because the
  // terminal prompt sits high — bottom-margin haunts feel less crowded.
  const r = rng();
  if (r < 0.45) return 'bottom';
  if (r < 0.85) return 'top';
  if (r < 0.93) return 'left';
  return 'right';
}

function placePhrase(el: HTMLElement, side: Side, rng = Math.random): void {
  if (side === 'top') {
    el.style.top = `${2 + rng() * 3}%`;
    el.style.left = `${15 + rng() * 55}%`;
  } else if (side === 'bottom') {
    el.style.bottom = `${3 + rng() * 4}%`;
    el.style.left = `${15 + rng() * 55}%`;
  } else if (side === 'left') {
    el.classList.add('haunting__phrase--left');
    el.style.left = '1.5%';
    el.style.top = `${30 + rng() * 30}%`;
  } else {
    el.classList.add('haunting__phrase--right');
    el.style.right = '1.5%';
    el.style.top = `${30 + rng() * 30}%`;
  }
}

export function createHaunting(): HauntingAPI {
  const layer = document.createElement('div');
  layer.className = 'haunting';
  document.body.appendChild(layer);

  let timer: number | null = null;
  let stopped = false;
  let firstFiring = true;

  function showPhrase(phrase: string, side: Side): void {
    const el = document.createElement('div');
    el.className = 'haunting__phrase';
    el.textContent = phrase;
    placePhrase(el, side);
    layer.appendChild(el);
    // Force one frame so the transition runs from 0 → 0.18 rather than
    // the element appearing at its target opacity instantly.
    requestAnimationFrame(() => el.classList.add('visible'));
    window.setTimeout(() => {
      el.classList.remove('visible');
      window.setTimeout(() => el.remove(), FADE_OUT_MS + 200);
    }, HOLD_MS);
  }

  function scheduleNext(): void {
    if (stopped) return;
    const delay = firstFiring ? pickFirstDelay() : pickDelay();
    firstFiring = false;
    timer = window.setTimeout(() => {
      // If the tab is hidden, defer rather than fire into the void.
      if (document.hidden) {
        scheduleNext();
        return;
      }
      showPhrase(pickPhrase(), pickSide());
      // Roughly half the time, thicken the atmosphere — boost the whisper
      // engine briefly so the haunting feels layered, not isolated.
      if (Math.random() < 0.5) boostWhispers(45_000);
      scheduleNext();
    }, delay);
  }

  scheduleNext();

  return {
    stop() {
      stopped = true;
      if (timer != null) { window.clearTimeout(timer); timer = null; }
      layer.remove();
    },
    fireOnce(phrase, side) {
      showPhrase(phrase ?? pickPhrase(), side ?? pickSide());
    },
  };
}
