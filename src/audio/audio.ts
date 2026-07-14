import { zzfx, setZzfxContext } from './zzfx';

export type AudioCategory = 'shell' | 'void' | 'program' | 'dilenci' | 'ambient' | 'music';
export type VibeLevel = 'off' | 'low' | 'medium' | 'high';

interface CategoryConfig {
  off: boolean;
  low: boolean;
  medium: boolean;
  high: boolean;
}

const CATEGORY_VIBE: Record<AudioCategory, CategoryConfig> = {
  shell:   { off: false, low: true,  medium: true, high: true },
  void:    { off: false, low: true,  medium: true, high: true },
  program: { off: false, low: false, medium: true, high: true },
  dilenci: { off: false, low: true,  medium: true, high: true },
  ambient: { off: false, low: false, medium: false, high: true },
  music:   { off: false, low: true,  medium: true, high: true },
};

const SAMPLES: Record<string, number[]> = {
  // ZzFX params — keep short, low volume
  'shell.keypress':   [0.05, 0.02, 50, 0, 0.01, 0.02, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.1],
  'shell.enter':      [0.07, 0.02, 80, 0, 0.02, 0.04, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.1],
  'shell.error':      [0.1,  0.1,  120, 0.02, 0.05, 0.15, 2, 1, 0, 0, 0, 0, 0, 0.1],
  'boot.ok':          [0.04, 0.02, 200, 0, 0.02, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2],
  'boot.warn':        [0.06, 0.05, 150, 0, 0.06, 0.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1],
  'boot.complete':    [0.15, 0.05, 110, 0.05, 0.3, 0.3, 0, 1, 0, 0, 0, 0, 0, 0.1, 0, 0],
  'void.shine':       [0.08, 0.1,  600, 0.05, 0.1, 0.15, 0, 1, 0, 0, 0, 0, 0, 0.05, 0, 0],
  'void.crackle':     [0.06, 0.5,  100, 0, 0.01, 0.05, 3, 1, 0, 0, 0, 0, 0, 0.3],
  'easter.fireworks': [0.2,  0.5,  200, 0, 0.15, 0.6, 3, 1, 0, 0, 0, 0, 0, 1],
  'undertow.enter':   [0.045, 0.35, 70, 0.04, 0.25, 0.65, 0, 1, -0.2, 0, 0, 0, 0, 0.08],
  'undertow.tide':    [0.035, 0.55, 42, 0.08, 0.45, 0.8, 0, 1, 0.1, 0, 0, 0, 0, 0.12],
  'undertow.release': [0.055, 0.18, 118, 0.02, 0.18, 0.48, 1, 1, -0.4, 0, 0, 0, 0, 0.1],
};

export interface AudioAPI {
  init(): Promise<void>;
  play(sample: string, category?: AudioCategory): void;
  setVibe(level: VibeLevel): void;
  getVibe(): VibeLevel;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
}

const VIBE_KEY = 'theorkan.vibe';
const MUTE_KEY = 'theorkan.muted';

export function createAudio(): AudioAPI {
  let ctx: AudioContext | null = null;
  let vibe: VibeLevel = (localStorage.getItem(VIBE_KEY) as VibeLevel) || 'medium';
  let muted = localStorage.getItem(MUTE_KEY) === '1';

  return {
    async init() {
      if (ctx) return;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      if (ctx.state === 'suspended') await ctx.resume();
      setZzfxContext(ctx);
    },
    play(sample, category = 'shell') {
      if (muted) return;
      if (!CATEGORY_VIBE[category][vibe]) return;
      const params = SAMPLES[sample];
      if (!params) return;
      try { zzfx(...params); } catch { /* ignore */ }
    },
    setVibe(level) {
      vibe = level;
      try { localStorage.setItem(VIBE_KEY, level); } catch { /* */ }
    },
    getVibe() { return vibe; },
    mute() { muted = true; try { localStorage.setItem(MUTE_KEY, '1'); } catch { /* */ } },
    unmute() { muted = false; try { localStorage.removeItem(MUTE_KEY); } catch { /* */ } },
    isMuted() { return muted; },
  };
}
