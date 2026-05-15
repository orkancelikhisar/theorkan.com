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
import { isOnVoice, isReplyOnVoice } from './filter';
import type { ChatTurn } from './llm';

const LEDGER_PATH = '/home/orkan/.dilenci/ledger.txt';
const OFFER_HUNGER_THRESHOLD = 0.45;
const APPEARANCE_AUTO_CLOSE_MS = 7_000;
const DEPART_DISPLAY_MS = 2_000;
const IDLE_TICK_MS = 12_000;
const WHISPER_TICK_MS = 35_000;
const FIRST_APPEARANCE_MIN_MS = 25_000;
const FIRST_APPEARANCE_MAX_MS = 45_000;
const GHOST_POEM_MIN_MS = 90_000;
const GHOST_POEM_MAX_MS = 180_000;
const TERMINATE_WORDS = ['bye', 'goodbye', 'leave', 'enough', 'thanks', 'thank you', 'ok bye', 'stop'];
const PASSION_WORDS = ['love', 'romance', 'poem', 'passion', 'longing', 'kiss'];
const TENDER_DEVICES = ['/dev/heart', '/dev/regret', '/dev/eyes'];
const DILENCI_WHISPERS = [
  'remnant', 'unsent', 'drawer', 'ledger', 'tuesday', 'lemon', 'small',
  'almost', 'before', 'kept', 'softer', 'mostly', 'tender', 'longing',
  'archive', 'paragraph', 'half', 'comma', 'never', 'kitchen',
];

type LlmAdapter = {
  ready: () => boolean;
  generate: (kind: 'stir' | 'beg', toneLabel: string, recentLedger: string[]) => Promise<string | null>;
  respond: (history: ChatTurn[], userLine: string, toneLabel: string) => Promise<string | null>;
  poem: (toneLabel: string) => Promise<string | null>;
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
  status(): { hunger: number; tone: string; silenced: boolean; llm: 'ready' | 'pending' };
  isInOfferMode(): boolean;
  feedFromOfferLine(line: string): void;
  escapeOffer(): void;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isTerminator(line: string): boolean {
  const t = line.trim().toLowerCase();
  if (!t) return false;
  return TERMINATE_WORDS.some((w) => t === w || t.startsWith(w + ' '));
}

// Aggressively distill raw LLM output into something that sounds like Dilenci.
// SmolLM2 still tends toward parentheticals, exclamations, and runs-of-talk.
// We pull out the first usable sentence, cap length cleanly at a word
// boundary, and lowercase. Never cut a word in half.
function normalizeReply(raw: string): string {
  if (!raw) return '';
  let s = raw;

  // Strip leading role tags the model sometimes regurgitates.
  s = s.replace(/^(assistant|dilenci|he|response)\s*:\s*/i, '');
  // Strip parenthetical asides — the model loves these and they always sound
  // like commentary rather than dialogue.
  s = s.replace(/\([^)]*\)/g, ' ');
  // Strip markdown emphasis bursts (**bold**, __italic__).
  s = s.replace(/[*_]{2,}/g, ' ');
  // Strip escape sequences and stray backslash-quotes.
  s = s.replace(/\\["n'tr]/g, ' ');
  // Strip quote glyphs entirely so leading/trailing quotes don't survive.
  s = s.replace(/[""''`]+/g, '');
  // Strip emoticons before stripping all punctuation runs.
  s = s.replace(/[;:][-]?[)(\][DPpoO]/g, '');
  // Strip emoji.
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '');
  // Soften exclamations into periods — he never raises his voice.
  s = s.replace(/!+/g, '.');
  // Strip URL-y noise and numeric artifacts the model occasionally invents.
  s = s.replace(/https?:\S+/g, '');
  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim();

  // Split on sentence boundaries. "...." counts as a single terminator, not
  // four mini-sentences, because we look back at the last terminator-char.
  const sentences = s
    .split(/(?<=[.…?])\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (sentences.length === 0) return '';

  // Prefer the first sentence that has some substance — at least 12 chars.
  // Otherwise concatenate the first two so a fragment like "here...." doesn't
  // become the whole reply.
  let result = sentences.find((t) => t.length >= 12) ?? sentences[0];
  // If we picked something very short, glue on the next sentence too.
  if (result.length < 28 && sentences.length > 1) {
    const next = sentences.find((t) => t !== result && t.length >= 8);
    if (next) result = `${result} ${next}`;
  }

  // Cap length at a word boundary at most ~150 chars. No "..." trailer —
  // it makes the truncation obvious in a way Dilenci's voice never is.
  if (result.length > 150) {
    // Find the last sentence-end within the cap; if none, the last space.
    const cut = result.slice(0, 150);
    const sentenceCut = cut.match(/.*[.…?](?=\s|$)/);
    if (sentenceCut && sentenceCut[0].length >= 40) {
      result = sentenceCut[0];
    } else {
      const lastSpace = cut.lastIndexOf(' ');
      result = lastSpace > 60 ? cut.slice(0, lastSpace) : cut;
    }
  }

  // Trim leading/trailing punctuation noise.
  result = result.replace(/^[,.\-—\s]+|[\s\-—]+$/g, '').trim();
  return result.toLowerCase();
}

function isPoemOnVoice(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 8 || t.length > 220) return false;
  if (/[!]/.test(t)) return false;
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)) return false;
  if (/i'?m |as an ai|as a language|assistant:|```/i.test(t)) return false;
  if (t.split('\n').length > 5) return false;
  return true;
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

  let conversation: ChatTurn[] = [];

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
        if (out) {
          const norm = normalizeReply(out);
          if (isOnVoice(norm)) cachedStir = norm;
        }
      } finally { primingStir = false; }
    }
    if (!cachedBeg && !primingBeg) {
      primingBeg = true;
      try {
        const out = await deps.llm.generate('beg', tone, recent);
        if (out) {
          const norm = normalizeReply(out);
          if (isOnVoice(norm)) cachedBeg = norm;
        }
      } finally { primingBeg = false; }
    }
  }

  function pickOpeningLine(kind: 'stir' | 'beg'): string {
    if (deps.llm?.ready()) {
      const cached = kind === 'stir' ? cachedStir : cachedBeg;
      if (cached) {
        if (kind === 'stir') cachedStir = null; else cachedBeg = null;
        return cached;
      }
    }
    return pick(kind === 'stir' ? STIR_LINES : BEG_LINES);
  }

  function enterOfferMode(openingLine: string): void {
    inOfferMode = true;
    deps.terminal.setInputMode('offer');
    panel.setExpression('alert');
    conversation = [{ role: 'assistant', content: openingLine }];
    deps.terminal.println(`he: ${openingLine}`, { dim: true });
    // Surface the prompt change as an event — main.ts owns prompt rendering
    // so the terminal prompt and the dilenci panel never disagree.
    deps.events.emit('dilenci:offer-opened', null);
  }

  function leaveOfferMode(): void {
    if (!inOfferMode) return;
    inOfferMode = false;
    deps.terminal.setInputMode('shell');
    conversation = [];
    deps.events.emit('dilenci:offer-closed', null);
  }

  function appear(forceBegMode = false): void {
    if (state.get().silenced) return;
    if (panel.isOpen()) return;

    triggers.markFired();
    state.bumpOnAppearance();

    const tone = state.tone();
    const naturalBeg = tone === 'restless' || tone === 'starving' || state.get().hunger > OFFER_HUNGER_THRESHOLD;
    const begMode = forceBegMode || naturalBeg;
    const opening = pickOpeningLine(begMode ? 'beg' : 'stir');

    deps.voidApi.shine();
    deps.audio.play('void.shine', 'void');

    if (begMode) {
      panel.open(opening, 'tell him: a line. or `bye`.');
      enterOfferMode(opening);
    } else {
      panel.open(opening);
      clearTimer();
      autoCloseTimer = window.setTimeout(() => panel.close(), APPEARANCE_AUTO_CLOSE_MS);
    }

    void primeCache();
  }

  function endConversation(): void {
    // The conversation only ends on direct user action — Esc, terminator
    // word, or `dilenci silence`. Dilenci himself never bows out.
    const farewell = pick(DEPART_LINES);
    deps.terminal.println(`he: ${farewell}`, { dim: true });
    panel.setLine(farewell);
    panel.setExpression('sad');
    leaveOfferMode();
    clearTimer();
    autoCloseTimer = window.setTimeout(() => panel.close(), DEPART_DISPLAY_MS);
  }

  async function handleOffering(rawLine: string): Promise<void> {
    const trimmed = rawLine.trim();
    if (!trimmed) { endConversation(); return; }
    if (isTerminator(trimmed)) { endConversation(); return; }

    ledger.append(trimmed);
    state.feed(trimmed);
    writeLedgerFile();
    conversation.push({ role: 'user', content: trimmed });

    panel.setExpression('thinking');

    let response: string | null = null;
    if (deps.llm?.ready()) {
      try {
        const out = await deps.llm.respond(conversation, trimmed, state.toneLabel());
        if (out) {
          // Normalize FIRST, then filter — role tags like "assistant:" get
          // stripped before the on-voice check, so legitimate Dilenci output
          // doesn't get rejected over a prefix the model added.
          const norm = normalizeReply(out);
          const passed = norm.length > 0 && isReplyOnVoice(norm);
          // Visible at console "Verbose" level — handy for tuning the filter
          // without surfacing noise to the visitor.
          console.debug('[dilenci] llm raw:', JSON.stringify(out), '→', passed ? 'kept' : 'filtered → ACK');
          if (passed) response = norm;
        } else {
          console.debug('[dilenci] llm returned empty → ACK');
        }
      } catch (err) {
        console.debug('[dilenci] llm threw → ACK', err);
      }
    }
    if (!response) response = pick(ACK_LINES);

    conversation.push({ role: 'assistant', content: response });
    deps.terminal.println(`he: ${response}`, { dim: true });
    panel.setLine(response);
    // Per Orkan: he never shuts the conversation down himself. He just keeps
    // waiting. So we drop the previous sated/maxturns auto-end. The user
    // decides when it's over.
    if (inOfferMode) panel.setExpression('alert');
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
    if (state.get().silenced) return;
    const h = state.get().hunger;
    const p = 0.25 + h * 0.55;
    if (Math.random() < p) {
      deps.voidApi.whisper(pick(DILENCI_WHISPERS));
    }
  }

  // ── ghost poems ─────────────────────────────────────────────────────────
  // Faded, position-randomized DOM nodes that fade in for ~10s and dissolve.
  // LLM-generated when the worker is ready, else cobbled from seed BEG lines.
  const ghostContainer = document.body;
  function showGhost(text: string): void {
    if (state.get().silenced) return;
    if (inOfferMode) return;        // don't crowd a live conversation
    const el = document.createElement('div');
    el.className = 'dilenci-ghost';
    el.textContent = text;
    // Pick a corner that avoids the panel (top-right) and the terminal core.
    const slots = [
      { left: '3vw',   top:    '60vh' },
      { left: '4vw',   top:    '40vh' },
      { left: '6vw',   bottom: '10vh' },
      { right: '40vw', bottom: '10vh' },
      { right: '6vw',  bottom: '10vh' },
      { left: '50vw',  bottom: '8vh'  },
      { left: '20vw',  top:    '12vh' },
    ];
    const slot = slots[Math.floor(Math.random() * slots.length)];
    Object.assign(el.style, slot as Partial<CSSStyleDeclaration>);
    ghostContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-shown'));
    const lifeMs = 9_000 + Math.random() * 5_000;
    window.setTimeout(() => {
      el.classList.remove('is-shown');
      window.setTimeout(() => el.remove(), 2_500);
    }, lifeMs);
  }

  async function ghostPoemTick(): Promise<void> {
    if (state.get().silenced || inOfferMode) { scheduleNextGhost(); return; }
    let text: string | null = null;
    if (deps.llm?.ready()) {
      try {
        const out = await deps.llm.poem(state.toneLabel());
        if (out) {
          const norm = normalizeReply(out);
          if (isPoemOnVoice(norm)) text = norm;
        }
      } catch { /* fall through */ }
    }
    if (!text) {
      // Seed fallback — pull 2 short stir/beg fragments and stack them.
      text = `${pick(STIR_LINES)}\n${pick(BEG_LINES)}`;
    }
    showGhost(text);
    scheduleNextGhost();
  }

  function scheduleNextGhost(): void {
    const wait = GHOST_POEM_MIN_MS + Math.random() * (GHOST_POEM_MAX_MS - GHOST_POEM_MIN_MS);
    window.setTimeout(() => void ghostPoemTick(), wait);
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

  window.setInterval(() => {
    lastIdleMs = Date.now() - lastActiveAt;
    if (lastIdleMs >= 90_000) rollAndMaybeAppear();
  }, IDLE_TICK_MS);
  window.setInterval(selfWhisper, WHISPER_TICK_MS);
  scheduleNextGhost();

  void primeCache();

  const firstDelay = FIRST_APPEARANCE_MIN_MS + Math.random() * (FIRST_APPEARANCE_MAX_MS - FIRST_APPEARANCE_MIN_MS);
  window.setTimeout(() => {
    if (state.get().silenced) return;
    triggers.setLastFired(0);
    appear();
  }, firstDelay);

  return {
    notify(eventName, payload) { deps.events.emit(`dilenci:${eventName}`, payload); },
    wake() {
      // Always conversational. `wake` is now the one and only entry point.
      state.wake();
      triggers.setLastFired(0);
      if (panel.isOpen()) panel.close();
      appear(true);
      // Surface LLM readiness so the visitor knows whether they're talking
      // to seeds or to the real thing.
      if (deps.llm && !deps.llm.ready()) {
        deps.terminal.println('(he is still loading. answers are seed-only for now.)', { dim: true });
      }
    },
    silence(toggle) {
      state.silence(toggle);
      if (toggle) {
        if (inOfferMode) leaveOfferMode();
        panel.close();
      }
    },
    status() {
      const s = state.get();
      return {
        hunger: s.hunger,
        tone: state.tone(),
        silenced: s.silenced,
        llm: deps.llm?.ready() ? 'ready' : 'pending',
      };
    },
    isInOfferMode() { return inOfferMode; },
    feedFromOfferLine(line) { void handleOffering(line); },
    escapeOffer() { endConversation(); },
  };
}
