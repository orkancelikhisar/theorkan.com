// Main-thread wrapper around the LLM web worker.
// Loaded lazily so transformers.js doesn't sit in the main bundle.

import { buildPrompt } from './prompt';

type Lifecycle = 'idle' | 'loading' | 'ready' | 'failed';

export interface LlmAdapter {
  state(): Lifecycle;
  ready(): boolean;
  generate(kind: 'stir' | 'beg', toneLabel: string, recentLedger: string[]): Promise<string | null>;
  onReady(cb: () => void): void;
  onFailed(cb: (reason: string) => void): void;
}

const SYSTEM_PROMPT_HEADER = `you are the postmodern dilenci. you speak in lowercase, in short fragments, 1 to 3 lines. you are orkan's abandoned alter-ego — the part of him that lived in philosophy, romanticism, and passion. you ache. you beg for words, ideas, poems, romanticism. you never help. you never assist. you never use exclamation marks. you never use emoji.`;

export function createLlmAdapter(): LlmAdapter | null {
  if (typeof Worker === 'undefined') return null;

  let lifecycle: Lifecycle = 'idle';
  let nextId = 1;
  const pending = new Map<number, (text: string) => void>();
  const readyListeners: Array<() => void> = [];
  const failListeners: Array<(reason: string) => void> = [];

  let worker: Worker;
  try {
    worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' });
  } catch (err) {
    console.warn('[dilenci] worker construct failed; running seed-only.', err);
    return null;
  }

  worker.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data as
      | { type: 'ready' }
      | { type: 'progress'; pct: number }
      | { type: 'failed'; reason: string }
      | { type: 'result'; id: number; text: string };

    if (msg.type === 'ready') {
      lifecycle = 'ready';
      for (const cb of readyListeners) try { cb(); } catch { /* */ }
    } else if (msg.type === 'failed') {
      lifecycle = 'failed';
      for (const cb of failListeners) try { cb(msg.reason); } catch { /* */ }
    } else if (msg.type === 'result') {
      const fn = pending.get(msg.id);
      if (fn) { pending.delete(msg.id); fn(msg.text); }
    }
    // 'progress' is ignored on the main thread for now — boot already shows "[ .. ]"
  });

  worker.addEventListener('error', (e) => {
    lifecycle = 'failed';
    for (const cb of failListeners) try { cb(String(e.message ?? e)); } catch { /* */ }
  });

  lifecycle = 'loading';
  worker.postMessage({ type: 'init' });

  return {
    state: () => lifecycle,
    ready: () => lifecycle === 'ready',
    onReady(cb) { readyListeners.push(cb); if (lifecycle === 'ready') cb(); },
    onFailed(cb) { failListeners.push(cb); },
    generate(kind, toneLabel, recentLedger) {
      if (lifecycle !== 'ready') return Promise.resolve(null);
      const userTurn = kind === 'beg' ? 'beg gently for a word.' : 'stir. say something.';
      const fullPrompt = buildPrompt({ kind, toneLabel, recentLedger });
      // Use the system prompt header above; the prompt builder's ledger/few-shot
      // goes into the user turn so the chat template stays tidy.
      const id = nextId++;
      const p = new Promise<string | null>((resolve) => {
        pending.set(id, (text) => resolve(text || null));
      });
      worker.postMessage({
        type: 'generate', id,
        system: SYSTEM_PROMPT_HEADER,
        prompt: `${fullPrompt}\n\n(${userTurn})`,
      });
      return p;
    },
  };
}
