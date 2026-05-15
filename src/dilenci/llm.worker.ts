/// <reference lib="webworker" />
// Web Worker hosting SmolLM2-360M-Instruct via transformers.js (§8.2).
// Communicates with the main thread via { type, ... } messages.

import { pipeline, env, type TextGenerationPipeline } from '@huggingface/transformers';

// transformers.js caches model weights in IndexedDB via its own backend; let
// it manage that. We don't bundle local model files.
env.allowLocalModels = false;
env.useBrowserCache = true;

type InMsg =
  | { type: 'init' }
  | { type: 'generate'; id: number; prompt: string; system: string };

type OutMsg =
  | { type: 'ready' }
  | { type: 'progress'; pct: number }
  | { type: 'failed'; reason: string }
  | { type: 'result'; id: number; text: string };

let generator: TextGenerationPipeline | null = null;

async function init(): Promise<void> {
  try {
    generator = (await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-360M-Instruct', {
      dtype: 'q4f16',
      progress_callback: (data: unknown) => {
        const d = data as { status?: string; progress?: number };
        if (d.status === 'progress' && typeof d.progress === 'number') {
          (self as unknown as Worker).postMessage({ type: 'progress', pct: d.progress } as OutMsg);
        }
      },
    })) as TextGenerationPipeline;
    (self as unknown as Worker).postMessage({ type: 'ready' } as OutMsg);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'failed',
      reason: (err as Error)?.message ?? 'unknown',
    } as OutMsg);
  }
}

async function generate(id: number, system: string, userTurn: string): Promise<void> {
  if (!generator) {
    (self as unknown as Worker).postMessage({ type: 'result', id, text: '' } as OutMsg);
    return;
  }
  try {
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: userTurn },
    ];
    const out = await generator(messages, {
      max_new_tokens: 36,
      temperature: 0.85,
      top_p: 0.92,
      repetition_penalty: 1.15,
      do_sample: true,
    });
    // transformers.js returns either a string or an array; coerce to a string.
    let text = '';
    const first = Array.isArray(out) ? out[0] : out;
    const gen = (first as { generated_text?: unknown }).generated_text;
    if (typeof gen === 'string') {
      text = gen;
    } else if (Array.isArray(gen)) {
      const last = gen[gen.length - 1] as { content?: string };
      text = last?.content ?? '';
    }
    (self as unknown as Worker).postMessage({ type: 'result', id, text } as OutMsg);
  } catch {
    (self as unknown as Worker).postMessage({ type: 'result', id, text: '' } as OutMsg);
  }
}

self.addEventListener('message', (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === 'init') void init();
  else if (msg.type === 'generate') void generate(msg.id, msg.system, msg.prompt);
});
