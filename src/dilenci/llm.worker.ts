/// <reference lib="webworker" />
// Web Worker hosting SmolLM2-360M-Instruct via transformers.js (§8.2).
// Two operations:
//   - generate: one-shot stir/beg lines (used at appearance time)
//   - respond:  multi-turn chat used during a sustained conversation

import { pipeline, env, type TextGenerationPipeline } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

type ChatTurn = { role: 'user' | 'assistant'; content: string };

type InMsg =
  | { type: 'init' }
  | { type: 'generate'; id: number; prompt: string; system: string }
  | { type: 'respond';  id: number; system: string; history: ChatTurn[]; user: string }
  | { type: 'poem';     id: number; system: string };

type OutMsg =
  | { type: 'ready' }
  | { type: 'progress'; pct: number }
  | { type: 'failed'; reason: string }
  | { type: 'result'; id: number; text: string };

let generator: TextGenerationPipeline | null = null;

function post(msg: OutMsg): void {
  (self as unknown as Worker).postMessage(msg);
}

// SmolLM2-360M-Instruct — known-good. Qwen2.5-0.5B-Instruct at q4f16 was
// degenerating into repetitive nonsense (the 0.5B variant takes too hard a
// quality hit from 4-bit quantization). 360M holds up better at this size.
const MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct';

async function loadWith(device: 'webgpu' | 'wasm'): Promise<TextGenerationPipeline> {
  return (await pipeline('text-generation', MODEL_ID, {
    dtype: 'q4f16',
    device,
    progress_callback: (data: unknown) => {
      const d = data as { status?: string; progress?: number };
      if (d.status === 'progress' && typeof d.progress === 'number') {
        post({ type: 'progress', pct: d.progress });
      }
    },
  })) as TextGenerationPipeline;
}

async function init(): Promise<void> {
  // WebGPU is dramatically faster than WASM for small LMs. Try it first, fall
  // back to WASM if the runtime, the browser, or the model variant aren't
  // happy with it. Either way the daemon's only contract is "ready or failed".
  try {
    try {
      generator = await loadWith('webgpu');
    } catch {
      generator = await loadWith('wasm');
    }
    post({ type: 'ready' });
  } catch (err) {
    post({ type: 'failed', reason: (err as Error)?.message ?? 'unknown' });
  }
}

function extractText(out: unknown): string {
  const first = Array.isArray(out) ? out[0] : out;
  const gen = (first as { generated_text?: unknown }).generated_text;
  if (typeof gen === 'string') return gen;
  if (Array.isArray(gen)) {
    // Chat-template output: array of role/content turns. Take the last
    // assistant turn — that's Dilenci's reply.
    for (let i = gen.length - 1; i >= 0; i--) {
      const turn = gen[i] as { role?: string; content?: string };
      if (turn?.role === 'assistant' && typeof turn.content === 'string') return turn.content;
    }
    const last = gen[gen.length - 1] as { content?: string };
    return last?.content ?? '';
  }
  return '';
}

async function generate(id: number, system: string, userTurn: string): Promise<void> {
  if (!generator) { post({ type: 'result', id, text: '' }); return; }
  try {
    const messages: ChatTurn[] = [
      { role: 'user', content: userTurn },
    ];
    const out = await generator(
      [{ role: 'system', content: system }, ...messages] as unknown as string,
      { max_new_tokens: 48, temperature: 0.85, top_p: 0.92, repetition_penalty: 1.15, do_sample: true, return_full_text: false },
    );
    post({ type: 'result', id, text: extractText(out) });
  } catch { post({ type: 'result', id, text: '' }); }
}

async function respond(id: number, system: string, history: ChatTurn[], userLine: string): Promise<void> {
  if (!generator) { post({ type: 'result', id, text: '' }); return; }
  try {
    const messages = [
      { role: 'system', content: system },
      ...history.slice(-8),                  // last 4 exchanges
      { role: 'user', content: userLine },
    ];
    const out = await generator(
      messages as unknown as string,
      {
        // Tight budget — Dilenci speaks in fragments. The normalizeReply pass
        // in the daemon would discard anything past the first sentence anyway,
        // so generating more tokens just wastes time on a small model.
        max_new_tokens: 48,
        temperature: 0.8,
        top_p: 0.9,
        repetition_penalty: 1.2,
        do_sample: true,
        return_full_text: false,
      },
    );
    post({ type: 'result', id, text: extractText(out) });
  } catch { post({ type: 'result', id, text: '' }); }
}

async function poem(id: number, system: string): Promise<void> {
  if (!generator) { post({ type: 'result', id, text: '' }); return; }
  try {
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: 'write a tiny poem. two or three short lines. lowercase. fragmentary. no rhyme, no exclamation.' },
    ];
    const out = await generator(
      messages as unknown as string,
      { max_new_tokens: 80, temperature: 0.9, top_p: 0.95, repetition_penalty: 1.18, do_sample: true, return_full_text: false },
    );
    post({ type: 'result', id, text: extractText(out) });
  } catch { post({ type: 'result', id, text: '' }); }
}

self.addEventListener('message', (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === 'init') void init();
  else if (msg.type === 'generate') void generate(msg.id, msg.system, msg.prompt);
  else if (msg.type === 'respond')  void respond(msg.id, msg.system, msg.history, msg.user);
  else if (msg.type === 'poem')     void poem(msg.id, msg.system);
});
