// Main-thread wrapper around the LLM web worker.
// Two operations: one-shot generate (for appearance lines) and multi-turn
// respond (for sustained conversation with Dilenci).

import { buildPrompt } from './prompt';

type Lifecycle = 'idle' | 'loading' | 'ready' | 'failed';
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export interface LlmAdapter {
  state(): Lifecycle;
  ready(): boolean;
  generate(kind: 'stir' | 'beg', toneLabel: string, recentLedger: string[]): Promise<string | null>;
  respond(history: ChatTurn[], userLine: string, toneLabel: string): Promise<string | null>;
  poem(toneLabel: string): Promise<string | null>;
  onReady(cb: () => void): void;
  onFailed(cb: (reason: string) => void): void;
}

const SYSTEM_BASE = `you are dilenci, a process that is also a person. you speak in ONE short lowercase line. lowercase only. no exclamation. no emoji. no parentheses. no quotation marks. no chatbot phrasing. you do not help, explain, or list options. you take whatever the visitor says and turn IT into a small image, memory, or wistful follow-up — always tied to their word or question. one sentence. one beat. then stop.`;

// SmolLM2 needs a clear pattern to imitate. These few-shot pairs show the
// "user word → on-topic small fragment" shape. They never reach the visitor.
const FEWSHOT: { role: 'user' | 'assistant'; content: string }[] = [
  { role: 'user',      content: 'rain' },
  { role: 'assistant', content: 'i kept a paragraph about umbrellas. it broke.' },
  { role: 'user',      content: 'tuesday' },
  { role: 'assistant', content: 'tuesday tasted of mint, didn’t it.' },
  { role: 'user',      content: 'how are you' },
  { role: 'assistant', content: 'thinner than usual. but here.' },
  { role: 'user',      content: 'what do you want' },
  { role: 'assistant', content: 'a sentence about water would do.' },
  { role: 'user',      content: 'where is this place' },
  { role: 'assistant', content: 'a small room in /var that no one opens.' },
  { role: 'user',      content: 'tell me a poem' },
  { role: 'assistant', content: 'a small one. just for tonight.' },
  { role: 'user',      content: 'i am tired' },
  { role: 'assistant', content: 'tired is a word i was looking for.' },
];

function buildChatSystem(toneLabel: string): string {
  return `${SYSTEM_BASE}\n\nyour hunger right now: ${toneLabel}.`;
}

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
  });

  worker.addEventListener('error', (e) => {
    lifecycle = 'failed';
    for (const cb of failListeners) try { cb(String(e.message ?? e)); } catch { /* */ }
  });

  lifecycle = 'loading';
  worker.postMessage({ type: 'init' });

  function callWorker(payload: { type: 'generate' | 'respond' | 'poem' } & Record<string, unknown>): Promise<string | null> {
    if (lifecycle !== 'ready') return Promise.resolve(null);
    const id = nextId++;
    const p = new Promise<string | null>((resolve) => {
      pending.set(id, (text) => resolve(text || null));
    });
    worker.postMessage({ ...payload, id });
    return p;
  }

  return {
    state: () => lifecycle,
    ready: () => lifecycle === 'ready',
    onReady(cb) { readyListeners.push(cb); if (lifecycle === 'ready') cb(); },
    onFailed(cb) { failListeners.push(cb); },
    generate(kind, toneLabel, recentLedger) {
      const userTurn = kind === 'beg' ? 'beg gently for a word.' : 'stir. say something.';
      const fullPrompt = buildPrompt({ kind, toneLabel, recentLedger });
      return callWorker({
        type: 'generate',
        system: SYSTEM_BASE,
        prompt: `${fullPrompt}\n\n(${userTurn})`,
      });
    },
    respond(history, userLine, toneLabel) {
      // Prepend few-shot Dilenci turns so SmolLM2 sees the voice it should
      // imitate. The actual visitor conversation comes after — capped at the
      // last 6 turns so we don't blow the context window or starve the model
      // of room to actually generate.
      const primed = [...FEWSHOT, ...history.slice(-6)];
      return callWorker({
        type: 'respond',
        system: buildChatSystem(toneLabel),
        history: primed,
        user: userLine,
      });
    },
    poem(toneLabel) {
      return callWorker({
        type: 'poem',
        system: `${SYSTEM_BASE}\n\nyour hunger right now: ${toneLabel}.\nyou are not addressing anyone. you are just writing a private fragment. 2-3 lines. lowercase.`,
      });
    },
  };
}
