import type { EventBus } from '../kernel/events';
import type { FS } from '../kernel/fs';
import type { VoidAPI } from '../void/void';
import type { AudioAPI } from '../audio/audio';
import type { TerminalAPI } from '../terminal/terminal';
import { createDilenciState, type DilenciStateAPI } from './state';
import { createTriggers, type TriggerAPI } from './triggers';
import { createLedger, type LedgerAPI } from './ledger';
import { createDilenciPanel, type DilenciPanelAPI } from './panel';
import { STIR_LINES, BEG_LINES, ACK_LINES, DEPART_LINES } from './seeds';
import { isOnVoice } from './filter';

const LEDGER_PATH = '/home/orkan/.dilenci/ledger.txt';
const OFFER_HUNGER_THRESHOLD = 0.45;     // slight buffer above default hunger
const APPEARANCE_AUTO_CLOSE_MS = 7_000;
const ACK_DISPLAY_MS = 3_500;
const DEPART_DISPLAY_MS = 2_000;
const IDLE_TICK_MS = 12_000;             // roll every 12s while idle
const WHISPER_TICK_MS = 35_000;          // his whispers — every ~35s
// Jittered first appearance: he doesn't wait for triggers to roll. He just
// shows up while the visitor is settling in.
const FIRST_APPEARANCE_MIN_MS = 25_000;
const FIRST_APPEARANCE_MAX_MS = 45_000;
const PASSION_WORDS = ['love', 'romance', 'poem', 'passion', 'longing', 'kiss'];
const TENDER_DEVICES = ['/dev/heart', '/dev/regret', '/dev/eyes'];
// Words Dilenci himself drops into the void — his vocabulary, not the generic
// whisper list. Slightly archaic, melancholic; mostly short.
const DILENCI_WHISPERS = [
  'remnant', 'unsent', 'drawer', 'ledger', 'tuesday', 'lemon', 'small',
  'almost', 'before', 'kept', 'softer', 'mostly', 'tender', 'longing',
  'archive', 'paragraph', 'half', 'comma', 'never', 'kitchen',
];

type LlmAdapter = {
  ready: () => boolean;
  generate: (kind: 'stir' | 'beg', toneLabel: string, recentLedger: string[]) => Promise<string | null>;
};

export interface DilenciDeps {
  events: EventBus;
  fs: FS;
  voidApi: VoidAPI;
  audio: AudioAPI;
  terminal: TerminalAPI;
  container: HTMLElement;
  llm?: LlmAdapter;
}

export interface DilenciAPI {
  notify(eventName: string, payload?: unknown): void;
  wake(): void;
  silence(toggle: boolean): void;
  status(): { hunger: number; tone: string; silenced: boolean };
  isInOfferMode(): boolean;
  feedFromOfferLine(line: string): void;
  escapeOffer(): void;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createDilenci(deps: DilenciDeps): DilenciAPI {
  const state: DilenciStateAPI = createDilenciState();
  const triggers: TriggerAPI = createTriggers();
  const ledger: LedgerAPI = createLedger();
  const panel: DilenciPanelAPI = createDilenciPanel(deps.container);

  let inOfferMode = false;
  let autoCloseTimer: number | null = null;
  let pendingMultiplier = 0;
  let recentErrorTimestamps: number[] = [];
  let lastActiveAt = Date.now();
  let lastIdleMs = 0;

  // LLM line cache. We prime in the background so on every appearance the
  // panel opens *immediately* from seeds, and the LLM contributes to the
  // NEXT appearance (no flicker, no wait).
  let cachedStir: string | null = null;
  let cachedBeg: string | null = null;
  let primingStir = false;
  let primingBeg = false;

  function clearTimer(): void {
    if (autoCloseTimer != null) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
  }

  function writeLedgerFile(): void {
    try { deps.fs.write(LEDGER_PATH, ledger.asFileContent()); }
    catch { /* path may not exist on first run; ignore */ }
  }

  async function primeCache(): Promise<void> {
    if (!deps.llm?.ready()) return;
    const tone = state.toneLabel();
    const recent = ledger.recent(10).map((e) => e.text);
    if (!cachedStir && !primingStir) {
      primingStir = true;
      try {
        const out = await deps.llm.generate('stir', tone, recent);
        if (out && isOnVoice(out)) cachedStir = out.trim();
      } finally { primingStir = false; }
    }
    if (!cachedBeg && !primingBeg) {
      primingBeg = true;
      try {
        const out = await deps.llm.generate('beg', tone, recent);
        if (out && isOnVoice(out)) cachedBeg = out.trim();
      } finally { primingBeg = false; }
    }
  }

  function pickLineSync(kind: 'stir' | 'beg'): string {
    const seedPool = kind === 'stir' ? STIR_LINES : BEG_LINES;
    if (deps.llm?.ready() && Math.random() < 0.7) {
      const cached = kind === 'stir' ? cachedStir : cachedBeg;
      if (cached) {
        if (kind === 'stir') cachedStir = null; else cachedBeg = null;
        return cached;
      }
    }
    return pick(seedPool);
  }

  function enterOfferMode(): void {
    inOfferMode = true;
    deps.terminal.setInputMode('offer');
    deps.terminal.setPrompt('offer> ');
    panel.setExpression('alert');
  }

  function leaveOfferMode(): void {
    inOfferMode = false;
    deps.terminal.setInputMode('shell');
    deps.events.emit('dilenci:offer-closed', null);
  }

  function appear(): void {
    if (state.get().silenced) return;
    if (panel.isOpen()) return;

    triggers.markFired();
    state.bumpOnAppearance();

    const tone = state.tone();
    const begMode = tone === 'restless' || tone === 'starving' || state.get().hunger > OFFER_HUNGER_THRESHOLD;
    const line = pickLineSync(begMode ? 'beg' : 'stir');

    deps.voidApi.shine();
    deps.audio.play('void.shine', 'void');

    if (begMode) {
      panel.open(line, 'offer> a line. or esc.');
      enterOfferMode();
    } else {
      panel.open(line);
      clearTimer();
      autoCloseTimer = window.setTimeout(() => panel.close(), APPEARANCE_AUTO_CLOSE_MS);
    }

    // Replenish for the next appearance — does not affect the panel open now.
    void primeCache();
  }

  function bumpRecentErrors(): number {
    const now = Date.now();
    recentErrorTimestamps = recentErrorTimestamps.filter((t) => now - t < 10_000);
    recentErrorTimestamps.push(now);
    return recentErrorTimestamps.length;
  }

  function inspectCommand(line: string): void {
    const trimmed = line.toLowerCase().trim();
    if (!trimmed) return;
    for (const dev of TENDER_DEVICES) {
      if (trimmed.includes(dev)) { pendingMultiplier += 20; break; }
    }
    for (const w of PASSION_WORDS) {
      const re = new RegExp(`\\b${w}\\b`, 'i');
      if (re.test(trimmed)) { pendingMultiplier += 30; break; }
    }
  }

  function rollAndMaybeAppear(): void {
    if (state.get().silenced) return;
    if (triggers.inCooldown()) { pendingMultiplier = 0; return; }
    if (panel.isOpen()) return;
    const ctx = {
      idleMs: lastIdleMs,
      hunger: state.get().hunger,
      multipliers: pendingMultiplier ? [pendingMultiplier] : [],
    };
    pendingMultiplier = 0;
    if (triggers.roll(ctx)) appear();
  }

  function selfWhisper(): void {
    // Dilenci drops his own words into the void. Frequency rises with hunger.
    if (state.get().silenced) return;
    const h = state.get().hunger;
    const p = 0.25 + h * 0.55; // 0.25 sated → 0.8 starving
    if (Math.random() < p) {
      deps.voidApi.whisper(pick(DILENCI_WHISPERS));
    }
  }

  // Event subscriptions
  deps.events.on('shell:idle', (p: unknown) => {
    const ms = (p as { ms: number })?.ms ?? 0;
    lastIdleMs = ms;
  });
  deps.events.on('shell:active', () => { lastIdleMs = 0; lastActiveAt = Date.now(); });
  deps.events.on('shell:command', (p: unknown) => {
    lastActiveAt = Date.now();
    const line = typeof p === 'string' ? p : (p as { line: string })?.line ?? '';
    inspectCommand(line);
    rollAndMaybeAppear();
  });
  deps.events.on('shell:error', () => {
    const n = bumpRecentErrors();
    if (n >= 3) { pendingMultiplier += 10; rollAndMaybeAppear(); }
  });
  deps.events.on('dilenci:hint', (p: unknown) => {
    const m = typeof p === 'number' ? p : 5;
    pendingMultiplier += m;
    rollAndMaybeAppear();
  });

  // Periodic ticks. These give Dilenci a life of his own even when the user is
  // away — without them, the kernel only fires shell:idle at 15s/30s and never
  // again, so the idle-escalation multiplier in triggers would go unused.
  window.setInterval(() => {
    lastIdleMs = Date.now() - lastActiveAt;
    if (lastIdleMs >= 90_000) rollAndMaybeAppear();
  }, IDLE_TICK_MS);

  window.setInterval(selfWhisper, WHISPER_TICK_MS);

  // Prime the LLM cache once the worker resolves so the FIRST natural
  // appearance can already use a generated line if 70% lands.
  void primeCache();

  // Scheduled first appearance — Dilenci is a resident. He doesn't wait for
  // the visitor to type the magic word. Roughly 25-45s after the daemon
  // initializes (boot is ~2s before that), he stirs unprompted.
  const firstDelay = FIRST_APPEARANCE_MIN_MS + Math.random() * (FIRST_APPEARANCE_MAX_MS - FIRST_APPEARANCE_MIN_MS);
  window.setTimeout(() => {
    if (state.get().silenced) return;
    // Bypass cooldown for the introduction.
    triggers.setLastFired(0);
    appear();
  }, firstDelay);

  // Public API
  return {
    notify(eventName, payload) { deps.events.emit(`dilenci:${eventName}`, payload); },
    wake() {
      state.wake();
      // Force an immediate appearance regardless of cooldown for `dilenci wake`.
      // Pretend the cooldown is expired so appear() runs.
      triggers.setLastFired(0);
      appear();
    },
    silence(toggle) { state.silence(toggle); if (toggle) panel.close(); },
    status() {
      const s = state.get();
      return { hunger: s.hunger, tone: state.tone(), silenced: s.silenced };
    },
    isInOfferMode() { return inOfferMode; },
    feedFromOfferLine(line) {
      const trimmed = line.trim();
      if (!trimmed) { this.escapeOffer(); return; }
      ledger.append(trimmed);
      state.feed(trimmed);
      writeLedgerFile();
      const ack = pick(ACK_LINES);
      panel.setLine(ack);
      panel.setExpression('happy');
      leaveOfferMode();
      clearTimer();
      autoCloseTimer = window.setTimeout(() => panel.close(), ACK_DISPLAY_MS);
    },
    escapeOffer() {
      state.refuse();
      const sad = pick(DEPART_LINES);
      panel.setLine(sad);
      panel.setExpression('sad');
      leaveOfferMode();
      clearTimer();
      autoCloseTimer = window.setTimeout(() => panel.close(), DEPART_DISPLAY_MS);
    },
  };
}
