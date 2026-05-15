// Hunger state machine for the Dilenci daemon (§8.4).
// A float in [0, 1], persisted in localStorage. Decays ~0.1/day.

const HUNGER_KEY = 'dilenci.hunger';
const HUNGER_TS_KEY = 'dilenci.hunger.ts';
const DAY_MS = 86_400_000;
const DECAY_PER_DAY = 0.1;
const DEFAULT_HUNGER = 0.4;

export type HungerTone = 'sated' | 'patient' | 'restless' | 'starving';

export interface DilenciState {
  hunger: number;
  silenced: boolean;
}

export interface DilenciStateAPI {
  get(): DilenciState;
  feed(line: string): void;          // visitor offered something; reduces hunger
  refuse(): void;                    // visitor escaped the offer; small bump up
  bumpOnAppearance(): void;          // every appearance edges hunger up slightly
  wake(): void;                      // `dilenci wake` — +0.2
  silence(toggle: boolean): void;
  tone(): HungerTone;
  toneLabel(): string;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function lengthFactor(text: string): number {
  // Longer/heartier offerings feed him more (capped).
  const len = text.trim().length;
  if (len === 0) return 0;
  return Math.min(1, len / 80);
}

function loadAndDecay(): { hunger: number; silenced: boolean } {
  const raw = parseFloat(localStorage.getItem(HUNGER_KEY) || `${DEFAULT_HUNGER}`);
  const lastTs = parseInt(localStorage.getItem(HUNGER_TS_KEY) || '0', 10);
  const silenced = localStorage.getItem('dilenci.silenced') === '1';
  let hunger = isFinite(raw) ? raw : DEFAULT_HUNGER;
  if (lastTs) {
    const elapsed = Date.now() - lastTs;
    hunger = clamp01(hunger - (elapsed / DAY_MS) * DECAY_PER_DAY);
  }
  return { hunger, silenced };
}

function persist(state: DilenciState): void {
  localStorage.setItem(HUNGER_KEY, String(state.hunger));
  localStorage.setItem(HUNGER_TS_KEY, String(Date.now()));
  localStorage.setItem('dilenci.silenced', state.silenced ? '1' : '0');
}

export function createDilenciState(): DilenciStateAPI {
  const initial = loadAndDecay();
  const state: DilenciState = { hunger: initial.hunger, silenced: initial.silenced };

  function commit(): void { persist(state); }

  return {
    get(): DilenciState { return { ...state }; },
    feed(line) {
      state.hunger = clamp01(state.hunger - (0.15 - lengthFactor(line) * 0.05));
      commit();
    },
    refuse() {
      state.hunger = clamp01(state.hunger + 0.05);
      commit();
    },
    bumpOnAppearance() {
      // Soft nudge — Dilenci is proactive, so per-appearance hunger growth
      // must stay small or he saturates the offer-mode threshold in minutes.
      state.hunger = clamp01(state.hunger + 0.008);
      commit();
    },
    wake() {
      state.hunger = clamp01(state.hunger + 0.2);
      commit();
    },
    silence(toggle) {
      state.silenced = toggle;
      commit();
    },
    tone() {
      const h = state.hunger;
      if (h < 0.2) return 'sated';
      if (h < 0.5) return 'patient';
      if (h < 0.8) return 'restless';
      return 'starving';
    },
    toneLabel() {
      switch (this.tone()) {
        case 'sated':    return 'he is full.';
        case 'patient':  return 'he is patient.';
        case 'restless': return 'he is restless.';
        case 'starving': return 'he is starving.';
      }
    },
  };
}
