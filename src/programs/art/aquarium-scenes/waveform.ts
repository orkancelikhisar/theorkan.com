import type { Scene } from './types';

// Two interfering sine waves drift across the canvas. The amplitude beats
// slowly with a low-frequency LFO. Mono bone on void.

interface State { phase: number; lfo: number; }

export const waveformScene: Scene<State> = {
  name: 'waveform',
  description: 'two slow interfering sine waves',
  init() {
    return { phase: 0, lfo: 0 };
  },
  frame(state, { ctx, width, height }, dtMs) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    state.phase += dtMs * 0.0015;
    state.lfo += dtMs * 0.00015;
    const amp = (height * 0.18) * (0.6 + 0.4 * Math.sin(state.lfo));
    const midY = height / 2;

    ctx.fillStyle = '#e8e6df';
    for (let x = 0; x < width; x++) {
      const k1 = x / width * Math.PI * 4;
      const k2 = x / width * Math.PI * 3;
      const y = midY + Math.sin(k1 + state.phase) * amp
                       + Math.sin(k2 - state.phase * 0.7) * amp * 0.5;
      ctx.fillRect(x, Math.round(y), 1, 1);
    }

    // dim guides
    ctx.fillStyle = '#3a3935';
    ctx.fillRect(0, Math.round(midY), width, 1);
  },
};
