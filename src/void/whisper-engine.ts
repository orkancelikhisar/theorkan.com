import type { VoidAPI } from './void';
import whispers from '../content/whispers.json';

declare global {
  // eslint-disable-next-line no-var
  var __theorkan_whisper_boost: number | undefined;
}

export function startWhisperEngine(voidApi: VoidAPI): () => void {
  function next(): number {
    const base = 60_000 + Math.random() * 60_000;
    const boostUntil = globalThis.__theorkan_whisper_boost || 0;
    const boost = Date.now() < boostUntil ? 0.5 : 1;
    return base * boost;
  }

  let timer: number;
  function schedule(): void {
    timer = window.setTimeout(() => {
      // Skip when the tab is hidden — otherwise throttled timers accumulate
      // and fire as a burst on refocus, flooding the void layer.
      if (!document.hidden && Math.random() < 0.6) {
        const word = whispers[Math.floor(Math.random() * whispers.length)];
        voidApi.whisper(word);
      }
      schedule();
    }, next());
  }
  schedule();

  return () => window.clearTimeout(timer);
}

export function boostWhispers(durationMs = 120_000): void {
  globalThis.__theorkan_whisper_boost = Date.now() + durationMs;
}
