import './undertow.css';
import { DILENCI_EYE_HEIGHT, DILENCI_EYE_WIDTH, renderDilenciEye } from '../../../dilenci/eye';
import dilenciFisherImageUrl from '../../../assets/undertow/dilenci-fisher-v2.png?url';
import type { Program, ProgramContext } from '../../../kernel/program';
import fallbackLines from '../../../content/undertow.json';
import {
  addVortex,
  attachFishingTether,
  attachTether,
  createGlyphBody,
  createWorld,
  disturbSurface,
  moveFishingTether,
  moveTether,
  nearestParticle,
  removeBody,
  releaseFishingTether,
  releaseTether,
  sampleFlow,
  sampleSurface,
  setBreathing,
  stepWorld,
  type GlyphBody,
  type Particle,
  type World,
} from './physics';
import { createLanguageCurrent, type LanguageCurrent } from './language';
import { hashText, lunarTide, moonName, semanticBuoyancy } from './tide';

const ARCHIVE_PATH = '/home/orkan/.dilenci/undertow.txt';
const LEDGER_PATH = '/home/orkan/.dilenci/ledger.txt';
const FIXED_DT = 1 / 60;
const MAX_BODIES = 10;
const MAX_SIMULATED_BODIES = MAX_BODIES + 2;
const MAX_ARCHIVE_LINES = 12;
const MAX_LINE_LENGTH = 88;

const BONE = '#e8e6df';
const BONE_DIM = '#88857c';
const BONE_FAINT = '#3a3935';
const VOID = '#0a0a0a';
const STREAM_LANES = [0.42, 0.55, 0.68, 0.81] as const;
const STREAM_SPEEDS = [0.044, 0.048, 0.042, 0.046] as const;
const FISHING_FIRST_CATCH_AFTER = 7.5;
const FISHER_ART = {
  width: 1774,
  height: 887,
  waterY: 648,
  eyeX: 1128,
  eyeY: 392,
  rodTipX: 170,
  rodTipY: 270,
} as const;

interface SeedLine {
  text: string;
  source: GlyphBody['source'];
  age: number;
}

interface QueuedLine {
  seed: SeedLine;
  preferredLane: number;
}

interface Silt {
  x: number;
  y: number;
  glyph: '·' | ',' | '—';
  alpha: number;
  speed: number;
}

interface PointerState {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  down: boolean;
  water: boolean;
  particle: Particle | null;
  pointerId: number | null;
}

type FishingPhase = 'lowering' | 'waiting' | 'reeling' | 'recovering';

interface FishingState {
  phase: FishingPhase;
  phaseStarted: number;
  laneIndex: number;
  hookX: number;
  hookY: number;
  startX: number;
  startY: number;
  caughtParticleId: number | null;
  caughtBodyId: number | null;
  overTension: number;
  catches: number;
  murmur: string;
  murmurAt: number;
  announcedCatch: boolean;
  announcedRelease: boolean;
  catchAfter: number;
}

interface UndertowState {
  ctx: ProgramContext;
  overlay: HTMLDivElement;
  canvas: HTMLCanvasElement;
  graphics: CanvasRenderingContext2D;
  intro: HTMLDivElement;
  readout: HTMLDivElement;
  composeLine: HTMLDivElement;
  note: HTMLDivElement;
  live: HTMLDivElement;
  mirror: HTMLDivElement;
  close: HTMLButtonElement;
  world: World;
  seeds: SeedLine[];
  seedIndex: number;
  language: LanguageCurrent;
  queue: QueuedLine[];
  laneCursor: number;
  nextStreamAt: number;
  silt: Silt[];
  pointer: PointerState;
  fishing: FishingState;
  fisherVisible: boolean;
  fisherImage: HTMLImageElement | null;
  archive: string[];
  writing: boolean;
  buffer: string;
  released: number;
  lastFractures: number;
  returned: boolean;
  openedAt: number;
  lastFrameAt: number;
  accumulator: number;
  width: number;
  height: number;
  dpr: number;
  reducedMotion: boolean;
  hidden: boolean;
  raf: number | null;
  abort: AbortController;
  resizeObserver: ResizeObserver | null;
  timers: number[];
  noteTimer: number | null;
  retireAt: Map<number, number>;
  lastReadoutAt: number;
  lastMirrorText: string;
  closed: boolean;
}

let active: UndertowState | null = null;

function safeRead(ctx: ProgramContext, path: string): string {
  try { return ctx.fs.read(path); } catch { return ''; }
}

function readArchive(ctx: ProgramContext): string[] {
  return safeRead(ctx, ARCHIVE_PATH)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-MAX_ARCHIVE_LINES);
}

function ledgerLines(ctx: ProgramContext): string[] {
  return safeRead(ctx, LEDGER_PATH)
    .split('\n')
    .map((line) => line.replace(/^\[[^\]]+\]\s*/, '').trim())
    .filter(Boolean)
    .slice(-2);
}

function regretLines(ctx: ProgramContext): string[] {
  let names: string[] = [];
  try { names = ctx.fs.list('/var/regret'); } catch { return []; }
  return names.map((name) => safeRead(ctx, `/var/regret/${name}`).trim()).filter(Boolean);
}

function buildSeeds(ctx: ProgramContext, archive: string[], seed: number): SeedLine[] {
  const pool: SeedLine[] = [
    ...ledgerLines(ctx).map((text) => ({ text, source: 'ledger' as const, age: 18 })),
    ...archive.slice(-2).map((text) => ({ text, source: 'archive' as const, age: 70 })),
    ...regretLines(ctx).map((text) => ({ text, source: 'regret' as const, age: 120 })),
  ];
  const offset = seed % fallbackLines.length;
  for (let i = 0; i < fallbackLines.length; i++) {
    pool.push({ text: fallbackLines[(offset + i) % fallbackLines.length], source: 'curated', age: 35 + i * 3 });
  }
  const seen = new Set<string>();
  return pool.filter(({ text }) => {
    const normalized = text.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, 5);
}

function updateCompose(state: UndertowState): void {
  state.composeLine.textContent = '';
  const prompt = document.createElement('span');
  prompt.className = 'undertow-compose__prompt';
  prompt.textContent = 'unsaid> ';
  const value = document.createTextNode(state.buffer);
  const cursor = document.createElement('span');
  cursor.className = 'undertow-compose__cursor';
  cursor.setAttribute('aria-hidden', 'true');
  state.composeLine.append(prompt, value, cursor);
  state.composeLine.setAttribute('aria-hidden', String(!state.writing));
  state.overlay.classList.toggle('is-writing', state.writing);
}

function announce(state: UndertowState, text: string): void {
  state.live.textContent = text;
}

function showNote(state: UndertowState, text: string, duration = 4_800): void {
  if (state.noteTimer != null) window.clearTimeout(state.noteTimer);
  state.note.textContent = text;
  state.note.classList.add('is-shown');
  const id = window.setTimeout(() => {
    if (state.noteTimer !== id) return;
    state.note.classList.remove('is-shown');
    state.noteTimer = null;
  }, duration);
  state.noteTimer = id;
  announce(state, text);
}

function removePhrase(state: UndertowState, body: GlyphBody): void {
  if (state.pointer.particle?.bodyId === body.id) {
    releasePointer(state);
  }
  if (state.fishing.caughtBodyId === body.id) recoverFishingLine(state);
  removeBody(state.world, body);
  state.retireAt.delete(body.id);
}

function beginRetirement(state: UndertowState, body: GlyphBody, now = performance.now()): void {
  if (state.retireAt.has(body.id)) return;
  body.opacity = 0.72;
  for (const particle of body.particles) particle.previousX = particle.x - 0.012;
  state.retireAt.set(body.id, now + 1_800);
}

function estimatedWidth(text: string): number {
  return Math.min(0.78, Math.max(0, [...text].length - 1) * 0.013);
}

function laneTarget(text: string, laneY: number): number {
  const semanticShift = (0.56 - semanticBuoyancy(text)) * 0.08;
  return Math.max(0.38, Math.min(0.86, laneY + semanticShift));
}

function streamSpeed(laneY: number): number {
  const index = STREAM_LANES.findIndex((lane) => lane === laneY);
  return STREAM_SPEEDS[index < 0 ? 0 : index];
}

function entryCrowding(state: UndertowState, laneY: number, text: string): number {
  const halfWidth = estimatedWidth(text) / 2;
  const entryMin = 0.5 - halfWidth;
  const entryMax = 0.5 + halfWidth;
  let crowding = 0;
  for (const body of state.world.bodies) {
    if (body.stream?.laneY !== laneY || state.retireAt.has(body.id)) continue;
    const bodyMin = Math.min(...body.particles.map((particle) => particle.x));
    const bodyMax = Math.max(...body.particles.map((particle) => particle.x));
    const overlap = Math.max(0, Math.min(entryMax, bodyMax) - Math.max(entryMin, bodyMin));
    if (overlap > 0) crowding += 1 + overlap;
  }
  return crowding;
}

function clearestEntryLane(state: UndertowState, text: string, preferred: number): number {
  let best = preferred;
  let bestCrowding = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset < STREAM_LANES.length; offset++) {
    const index = (preferred + offset) % STREAM_LANES.length;
    const crowding = entryCrowding(state, STREAM_LANES[index], text);
    if (crowding < bestCrowding) {
      best = index;
      bestCrowding = crowding;
    }
  }
  return best;
}

function makeRoomForVisitor(state: UndertowState): void {
  const heldBodyId = state.pointer.particle?.bodyId;
  const caughtBodyId = state.fishing.caughtBodyId;
  const living = state.world.bodies.filter((body) => !state.retireAt.has(body.id));
  if (living.length >= MAX_BODIES) {
    const oldest = living.find((body) => body.id !== heldBodyId && body.id !== caughtBodyId);
    if (oldest) beginRetirement(state, oldest);
  }
  while (state.world.bodies.length >= MAX_SIMULATED_BODIES) {
    const retired = state.world.bodies.find((body) => state.retireAt.has(body.id));
    if (!retired) break;
    removePhrase(state, retired);
  }
}

function spawnPhrase(
  state: UndertowState,
  seed: SeedLine,
  options: {
    x?: number;
    y?: number;
    lane?: number;
    fromLeft?: boolean;
    drop?: boolean;
  } = {},
): GlyphBody {
  const laneY = options.lane ?? STREAM_LANES[state.laneCursor % STREAM_LANES.length];
  const targetY = laneTarget(seed.text, laneY);
  const x = options.x ?? (options.fromLeft ? -0.035 - estimatedWidth(seed.text) / 2 : 0.5);
  const y = options.y ?? targetY;
  const speed = streamSpeed(laneY);
  const body = createGlyphBody(state.world, {
    text: seed.text,
    x,
    y,
    velocityX: speed * 0.22,
    velocityY: options.drop ? 0.018 : (state.world.rng() - 0.5) * 0.006,
    buoyancy: semanticBuoyancy(seed.text),
    brittleness: seed.source === 'archive' || seed.source === 'regret' ? 0.42 : 0.12,
    age: seed.age,
    source: seed.source,
    stream: {
      laneY,
      targetY,
      speed,
    },
  });
  return body;
}

function persistLine(state: UndertowState, raw: string): void {
  const line = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LINE_LENGTH);
  if (!line) return;
  state.archive = [...state.archive, line].slice(-MAX_ARCHIVE_LINES);
  try { state.ctx.fs.write(ARCHIVE_PATH, state.archive.join('\n')); } catch { /* local memory can be full */ }
}

function releaseLine(state: UndertowState, raw: string): void {
  const line = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LINE_LENGTH);
  if (!line) return;
  persistLine(state, line);
  const preferredLane = state.laneCursor++ % STREAM_LANES.length;
  const seed: SeedLine = { text: line, source: 'visitor', age: 0 };
  if (state.reducedMotion) {
    const lane = STREAM_LANES[preferredLane];
    const incumbent = state.world.bodies.find((body) => body.stream?.laneY === lane);
    if (incumbent) removePhrase(state, incumbent);
    spawnPhrase(state, seed, { x: 0.5, y: lane, lane });
  } else {
    const laneIndex = clearestEntryLane(state, line, preferredLane);
    const lane = STREAM_LANES[laneIndex];
    state.laneCursor = laneIndex + 1;
    makeRoomForVisitor(state);
    spawnPhrase(state, seed, {
      x: 0.5,
      y: state.world.surfaceY - 0.075,
      lane,
      drop: true,
    });
  }
  disturbSurface(state.world, 0.5, 0.22, 0.08);
  state.ctx.audio.play('undertow.release');
  state.ctx.events.emit('undertow:offering', {
    length: line.length,
    buoyancy: semanticBuoyancy(line),
  });
  state.released += 1;
  if (state.released === 1) showNote(state, 'it has weight now.');
  announce(state, 'the line entered the current.');
}

function beginWriting(state: UndertowState, first = ''): void {
  setStateBreathing(state, false);
  if (state.world.fishingTether) recoverFishingLine(state);
  state.writing = true;
  state.buffer = first.slice(0, MAX_LINE_LENGTH);
  updateCompose(state);
  announce(state, 'writing. enter gives the line weight. escape keeps it unsaid.');
}

function setStateBreathing(state: UndertowState, holding: boolean): void {
  setBreathing(state.world, holding);
  // Reduced-motion mode freezes the solver, so reveal the text directly.
  if (state.reducedMotion) state.world.breathing = holding ? 1 : 0;
  state.overlay.classList.toggle('is-breathing', holding);
}

interface FisherGeometry {
  seatX: number;
  bankY: number;
  rodTipX: number;
  rodTipY: number;
}

interface FisherArtLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  eyeX: number;
  eyeY: number;
  rodTipX: number;
  rodTipY: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function softStep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function fisherArtLayout(state: UndertowState, animate = false): FisherArtLayout {
  const bankY = (state.world.surfaceY + state.world.tideOffset - 4 / state.height) * state.height;
  const baseScale = Math.max(0.01, Math.min(
    state.width / FISHER_ART.width,
    bankY / FISHER_ART.waterY,
  ) * 0.5);
  const motion = animate && !state.reducedMotion ? 1 : 0;
  const breath = Math.sin(state.world.time * 0.47) * motion;
  const sway = (
    Math.sin(state.world.time * 0.29 + 1.1)
    + Math.sin(state.world.time * 0.73) * 0.38
  ) * 1.5 * motion;
  const scaleX = baseScale * (1 + breath * 0.004);
  const scaleY = baseScale * (1 + breath * 0.006);
  const width = FISHER_ART.width * scaleX;
  const height = FISHER_ART.height * scaleY;
  const x = state.width - width + sway;
  // Anchor the generated image's own horizon to the simulated waterline.
  const y = bankY - FISHER_ART.waterY * scaleY;
  return {
    x,
    y,
    width,
    height,
    scaleX,
    scaleY,
    eyeX: x + FISHER_ART.eyeX * scaleX,
    eyeY: y + FISHER_ART.eyeY * scaleY,
    rodTipX: x + FISHER_ART.rodTipX * scaleX,
    rodTipY: y + FISHER_ART.rodTipY * scaleY,
  };
}

function fisherGeometry(state: UndertowState): FisherGeometry {
  const bankY = state.world.surfaceY + state.world.tideOffset - 4 / state.height;
  const art = fisherArtLayout(state);
  return {
    seatX: art.eyeX / state.width,
    bankY,
    rodTipX: Math.max(0.06, Math.min(0.9, art.rodTipX / state.width)),
    rodTipY: Math.max(0.04, Math.min(bankY - 0.02, art.rodTipY / state.height)),
  };
}

function restingHook(state: UndertowState): { x: number; y: number } {
  const geometry = fisherGeometry(state);
  const phase = state.world.time + state.fishing.laneIndex * 1.73;
  return {
    x: Math.max(0.42, geometry.rodTipX - 0.026 + Math.sin(phase * 0.53) * 0.007),
    y: Math.max(
      state.world.surfaceY + 0.035,
      Math.min(0.88, STREAM_LANES[state.fishing.laneIndex] + Math.sin(phase * 0.91) * 0.022),
    ),
  };
}

function fishingParticle(state: UndertowState): Particle | null {
  const id = state.fishing.caughtParticleId;
  if (id == null) return null;
  for (const body of state.world.bodies) {
    const particle = body.particles.find((candidate) => candidate.id === id);
    if (particle) return particle;
  }
  return null;
}

function chooseFishingLane(state: UndertowState): number {
  const geometry = fisherGeometry(state);
  const hookX = Math.max(0.42, geometry.rodTipX - 0.026);
  const laneCount = state.width < 640 || state.height < 520 ? 3 : STREAM_LANES.length;
  let bestLane = (state.fishing.laneIndex + 1) % laneCount;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const body of state.world.bodies) {
    if (!body.stream || state.retireAt.has(body.id) || body.id === state.pointer.particle?.bodyId) continue;
    const laneIndex = STREAM_LANES.findIndex((lane) => lane === body.stream?.laneY);
    if (laneIndex < 0 || laneIndex >= laneCount) continue;
    for (const particle of body.particles) {
      if (particle.glyph === ' ' || particle.x < 0.14 || particle.x > 0.84) continue;
      const approach = Math.abs(particle.x - hookX);
      const sourceBias = body.source === 'visitor' ? -0.09 : body.source === 'archive' ? -0.035 : 0;
      const score = approach + sourceBias;
      if (score < bestScore) {
        bestScore = score;
        bestLane = laneIndex;
      }
    }
  }
  return bestLane;
}

function nearestFishingCandidate(state: UndertowState): Particle | null {
  if (state.writing || state.pointer.down || state.world.tether) return null;
  let best: Particle | null = null;
  let bestScore = 38 * 38;
  for (const body of state.world.bodies) {
    if (!body.stream || state.retireAt.has(body.id) || body.id === state.pointer.particle?.bodyId) continue;
    for (const particle of body.particles) {
      if (particle.glyph === ' ' || particle.y <= sampleSurface(state.world, particle.x) + 0.008) continue;
      const dx = (particle.x - state.fishing.hookX) * state.width;
      const dy = (particle.y - state.fishing.hookY) * state.height;
      const sourceBias = body.source === 'visitor' ? 0.72 : body.source === 'archive' ? 0.88 : 1;
      const score = (dx * dx + dy * dy) * sourceBias;
      if (score < bestScore) {
        best = particle;
        bestScore = score;
      }
    }
  }
  return best;
}

function recoverFishingLine(state: UndertowState, murmur = ''): void {
  releaseFishingTether(state.world);
  const fishing = state.fishing;
  fishing.startX = fishing.hookX;
  fishing.startY = fishing.hookY;
  fishing.phase = 'recovering';
  fishing.phaseStarted = state.world.time;
  fishing.caughtParticleId = null;
  fishing.caughtBodyId = null;
  fishing.overTension = 0;
  fishing.murmur = murmur;
  fishing.murmurAt = state.world.time;
  fishing.catchAfter = state.world.time + 7 + state.world.rng() * 7;
  if (murmur && !fishing.announcedRelease) {
    fishing.announcedRelease = true;
    announce(state, `the word slipped from dilenci's line. ${murmur}`);
  }
}

function hookParticle(state: UndertowState, particle: Particle): void {
  const fishing = state.fishing;
  if (!attachFishingTether(state.world, particle.id, particle.x, particle.y, 0.008)) return;
  const body = state.world.bodies.find((candidate) => candidate.id === particle.bodyId);
  const narrate = fishing.catches === 0
    || body?.source === 'visitor'
    || /[.,;:!?—-]/.test(particle.glyph);
  fishing.hookX = particle.x;
  fishing.hookY = particle.y;
  fishing.startX = particle.x;
  fishing.startY = particle.y;
  fishing.caughtParticleId = particle.id;
  fishing.caughtBodyId = particle.bodyId;
  fishing.phase = 'reeling';
  fishing.phaseStarted = state.world.time;
  fishing.overTension = 0;
  fishing.catches += 1;
  fishing.murmur = narrate ? 'this one is heavier than it looks.' : '';
  fishing.murmurAt = state.world.time;
  state.ctx.audio.play('undertow.tide');
  if (!fishing.announcedCatch) {
    fishing.announcedCatch = true;
    announce(state, 'dilenci caught one letter. the eye narrows as its sentence bends downstream.');
  }
}

function updateFishing(state: UndertowState, dt: number): void {
  if (!state.fisherVisible || state.reducedMotion) return;
  const fishing = state.fishing;
  const elapsed = state.world.time - fishing.phaseStarted;
  const geometry = fisherGeometry(state);

  if (fishing.phase === 'lowering') {
    const target = restingHook(state);
    const t = softStep(elapsed / 1.65);
    fishing.hookX = mix(fishing.startX, target.x, t);
    fishing.hookY = mix(fishing.startY, target.y, t) - Math.sin(t * Math.PI) * 0.035;
    if (t >= 1) {
      fishing.phase = 'waiting';
      fishing.phaseStarted = state.world.time;
    }
    return;
  }

  if (fishing.phase === 'waiting') {
    const target = restingHook(state);
    fishing.hookX = target.x;
    fishing.hookY = target.y;
    const candidate = state.world.time >= fishing.catchAfter ? nearestFishingCandidate(state) : null;
    if (candidate) {
      hookParticle(state, candidate);
    } else if (elapsed > 18) {
      recoverFishingLine(state);
    }
    return;
  }

  if (fishing.phase === 'reeling') {
    const particle = fishingParticle(state);
    if (!particle || !state.world.fishingTether) {
      recoverFishingLine(state);
      return;
    }
    const t = clamp01(elapsed / 4.6);
    const eased = softStep(t);
    const landingX = Math.min(0.82, geometry.rodTipX + 0.055);
    const landingY = sampleSurface(state.world, landingX) - 0.042;
    fishing.hookX = mix(fishing.startX, landingX, eased);
    fishing.hookY = mix(fishing.startY, landingY, eased) - Math.sin(t * Math.PI) * 0.012;
    moveFishingTether(state.world, fishing.hookX, fishing.hookY, mix(0.008, 0.001, eased));
    const tension = state.world.fishingTether.tension;
    fishing.overTension = tension > 0.52
      ? fishing.overTension + dt
      : Math.max(0, fishing.overTension - dt * 0.5);
    const breached = particle.y < sampleSurface(state.world, particle.x) - 0.004 && t > 0.48;
    if (breached || t >= 1 || fishing.overTension > 0.62) {
      disturbSurface(state.world, particle.x, -0.13, 0.045);
      const releaseMurmur = fishing.murmur
        ? breached ? 'for a moment, he had the word.' : 'almost.'
        : '';
      recoverFishingLine(state, releaseMurmur);
    }
    return;
  }

  const t = softStep(elapsed / 1.25);
  fishing.hookX = mix(fishing.startX, geometry.rodTipX, t);
  fishing.hookY = mix(fishing.startY, geometry.rodTipY, t);
  if (elapsed > 2.65) {
    fishing.laneIndex = chooseFishingLane(state);
    fishing.phase = 'lowering';
    fishing.phaseStarted = state.world.time;
    fishing.startX = geometry.rodTipX;
    fishing.startY = geometry.rodTipY;
    fishing.hookX = geometry.rodTipX;
    fishing.hookY = geometry.rodTipY;
  }
}

function finishWriting(state: UndertowState): void {
  const line = state.buffer;
  state.buffer = '';
  state.writing = false;
  updateCompose(state);
  releaseLine(state, line);
}

function cancelWriting(state: UndertowState): void {
  state.buffer = '';
  state.writing = false;
  updateCompose(state);
  showNote(state, 'kept unsaid.', 2_400);
}

function handleKeyDown(state: UndertowState, e: KeyboardEvent): boolean {
  if (state.closed || e.isComposing) return false;
  const target = e.target as HTMLElement | null;
  if (target?.closest('.undertow-close') && (e.key === 'Enter' || e.key === ' ')) return false;
  if (e.key === 'Tab') {
    if (target?.closest('.undertow-close')) state.overlay.focus();
    else state.close.focus();
    return true;
  }

  if (state.writing) {
    if (e.key === 'Escape') { cancelWriting(state); return true; }
    if (e.key === 'Enter') { finishWriting(state); return true; }
    if (e.key === 'Backspace') {
      state.buffer = [...state.buffer].slice(0, -1).join('');
      updateCompose(state);
      return true;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && state.buffer.length < MAX_LINE_LENGTH) {
      state.buffer += e.key;
      updateCompose(state);
      return true;
    }
    return false;
  }

  if (e.key === 'Escape') { closeUndertow(); return true; }
  if (e.key === ' ') {
    setStateBreathing(state, true);
    announce(state, 'holding breath. submerged sentences are becoming readable.');
    return true;
  }
  if (e.key === 'Enter') { beginWriting(state); return true; }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    beginWriting(state, e.key);
    return true;
  }
  return false;
}

function handleKeyUp(state: UndertowState, e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (e.key !== ' ') return false;
  const wasBreathing = state.world.breathingTarget > 0 || state.overlay.classList.contains('is-breathing');
  if (target?.closest('.undertow-close') && !wasBreathing) return false;
  setStateBreathing(state, false);
  announce(state, 'breath released.');
  return true;
}

function pointerPosition(state: UndertowState, e: PointerEvent): { x: number; y: number } {
  const rect = state.canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))),
    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height))),
  };
}

function pickParticle(state: UndertowState, x: number, y: number): Particle | null {
  // Core lookup is a cheap first pass. Verify in screen space so selection
  // still feels circular on a very wide display.
  const candidate = nearestParticle(state.world, x, y, 0.07);
  if (!candidate) return null;
  if (state.retireAt.has(candidate.bodyId)) return null;
  const dx = (candidate.x - x) * state.width;
  const dy = (candidate.y - y) * state.height;
  return dx * dx + dy * dy <= 30 * 30 ? candidate : null;
}

function onPointerDown(state: UndertowState, e: PointerEvent): void {
  if (state.writing || state.closed || (e.target as HTMLElement | null)?.closest('.undertow-close')) return;
  if (!e.isPrimary || e.button !== 0 || state.pointer.down) return;
  const p = pointerPosition(state, e);
  releaseTether(state.world);
  state.pointer = {
    x: p.x,
    y: p.y,
    lastX: p.x,
    lastY: p.y,
    down: true,
    water: false,
    particle: null,
    pointerId: e.pointerId,
  };
  const hit = pickParticle(state, p.x, p.y);
  if (hit) {
    if (state.fishing.caughtBodyId === hit.bodyId) recoverFishingLine(state);
    state.pointer.particle = hit;
    // Begin at the glyph itself. A generous hit radius should not create
    // tension until the visitor actually moves their hand.
    attachTether(state.world, hit.id, hit.x, hit.y);
    state.overlay.classList.add('is-dragging');
    announce(state, 'a letter is tethered. the sentence is under tension.');
  } else {
    state.pointer.water = true;
    addVortex(state.world, p.x, p.y, 0.09, 0.14, 0.8);
  }
  try { state.canvas.setPointerCapture(e.pointerId); } catch { /* */ }
}

function onPointerMove(state: UndertowState, e: PointerEvent): void {
  if (state.pointer.down && state.pointer.pointerId !== e.pointerId) return;
  const p = pointerPosition(state, e);
  const dx = p.x - state.pointer.x;
  const dy = p.y - state.pointer.y;
  state.pointer.lastX = state.pointer.x;
  state.pointer.lastY = state.pointer.y;
  state.pointer.x = p.x;
  state.pointer.y = p.y;
  if (!state.pointer.down) return;

  if (state.pointer.particle) {
    moveTether(state.world, p.x, p.y);
  } else if (state.pointer.water) {
    const speed = Math.min(0.24, Math.sqrt(dx * dx + dy * dy) * 7 + 0.035);
    const direction = dx * dy < 0 ? -1 : 1;
    addVortex(state.world, p.x, p.y, speed * direction, 0.1 + speed * 0.35, 0.55);
    const surface = sampleSurface(state.world, p.x);
    if (Math.abs(p.y - surface) < 0.065) disturbSurface(state.world, p.x, dy * 2.8, 0.055);
  }
}

function releasePointer(state: UndertowState, e?: PointerEvent): void {
  if (e && state.pointer.pointerId !== e.pointerId) return;
  const pointerId = state.pointer.pointerId;
  releaseTether(state.world);
  if (pointerId != null) try {
    if (state.canvas.hasPointerCapture(pointerId)) state.canvas.releasePointerCapture(pointerId);
  } catch { /* */ }
  state.pointer.down = false;
  state.pointer.water = false;
  state.pointer.particle = null;
  state.pointer.pointerId = null;
  state.overlay.classList.remove('is-dragging');
}

function resizeCanvas(state: UndertowState): void {
  const rect = state.overlay.getBoundingClientRect();
  state.width = Math.max(1, rect.width);
  state.height = Math.max(1, rect.height);
  state.dpr = Math.min(2, window.devicePixelRatio || 1);
  state.canvas.width = Math.round(state.width * state.dpr);
  state.canvas.height = Math.round(state.height * state.dpr);
}

function createSilt(world: World, reduced: boolean): Silt[] {
  const glyphs: Silt['glyph'][] = ['·', '·', '·', ',', '—'];
  return Array.from({ length: reduced ? 42 : 128 }, () => ({
    x: world.rng(),
    y: world.surfaceY + 0.035 + world.rng() * (0.93 - world.surfaceY),
    glyph: glyphs[Math.floor(world.rng() * glyphs.length)],
    alpha: 0.08 + world.rng() * 0.16,
    speed: 0.35 + world.rng() * 0.75,
  }));
}

function updateSilt(state: UndertowState, dt: number): void {
  for (const grain of state.silt) {
    const flow = sampleFlow(state.world, grain.x, grain.y);
    grain.x += flow.x * dt * grain.speed;
    grain.y += flow.y * dt * grain.speed;
    if (grain.x < 0) grain.x += 1;
    if (grain.x > 1) grain.x -= 1;
    if (grain.y < state.world.surfaceY + 0.018) grain.y = 0.94;
    if (grain.y > 0.97) grain.y = state.world.surfaceY + 0.035;
  }
}

function drawSilt(state: UndertowState): void {
  const g = state.graphics;
  g.save();
  g.font = '9px "JetBrains Mono", "Berkeley Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = BONE_DIM;
  for (const grain of state.silt) {
    g.globalAlpha = grain.alpha * (1 - state.world.breathing * 0.55);
    g.fillText(grain.glyph, grain.x * state.width, grain.y * state.height);
  }
  g.restore();
}

function drawSurface(state: UndertowState, elapsed: number): void {
  const g = state.graphics;
  const points = state.world.surface;
  const reveal = state.reducedMotion ? 1 : Math.max(0, Math.min(1, elapsed / 1_500));
  const last = Math.max(1, Math.floor((points.length - 1) * reveal));
  g.save();
  g.beginPath();
  g.moveTo(points[0].x * state.width, points[0].y * state.height);
  for (let i = 1; i <= last; i++) g.lineTo(points[i].x * state.width, points[i].y * state.height);
  g.strokeStyle = BONE_DIM;
  g.globalAlpha = 0.48;
  g.lineWidth = 1;
  g.stroke();

  // A broken second trace makes the water feel measured rather than filled.
  g.setLineDash([1, 9]);
  g.beginPath();
  for (let i = 0; i <= last; i++) {
    const p = points[i];
    const x = p.x * state.width;
    const y = p.y * state.height + 5;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.strokeStyle = BONE_FAINT;
  g.globalAlpha = 0.25;
  g.stroke();
  g.restore();
}

function drawDilenci(state: UndertowState): void {
  if (!state.fisherVisible) return;
  const g = state.graphics;
  const geometry = fisherGeometry(state);
  const compact = state.width < 640 || state.height < 520;
  const bankY = geometry.bankY * state.height;
  const imageReady = Boolean(state.fisherImage?.complete && state.fisherImage.naturalWidth > 0);
  const art = fisherArtLayout(state, imageReady);
  const drift = state.reducedMotion ? 0 : Math.sin(state.world.time * 0.61) * 1.25;
  const entityX = imageReady ? art.eyeX : geometry.seatX * state.width;
  const entityY = imageReady
    ? art.eyeY
    : bankY - (state.height < 520 ? 52 : compact ? 62 : 84) + drift;
  const tipX = imageReady ? art.rodTipX : geometry.rodTipX * state.width;
  const tipY = imageReady ? art.rodTipY : geometry.rodTipY * state.height;
  const hookX = state.fishing.hookX * state.width;
  const hookY = state.fishing.hookY * state.height;
  const tension = state.world.fishingTether?.tension ?? 0;
  const dim = state.writing ? 0.48 : 1;
  const eyeFont = imageReady
    ? Math.max(2.8, Math.min(5.4, art.scaleX * 17.8))
    : compact
      ? Math.max(4.3, Math.min(5.3, state.width / 112))
      : Math.max(5.8, Math.min(7.3, state.height / 104));
  const lineHeight = eyeFont * 0.94;
  const eyeWidth = eyeFont * 0.605 * DILENCI_EYE_WIDTH;
  const eyeHeight = lineHeight * DILENCI_EYE_HEIGHT;
  const attention = fishingParticle(state);
  const targetX = attention ? attention.x : state.pointer.x;
  const targetY = attention ? attention.y : state.pointer.y;
  const lookX = state.reducedMotion ? 0 : Math.max(-1, Math.min(1, (targetX * state.width - entityX) / (state.width * 0.34)));
  const lookY = state.reducedMotion ? 0 : Math.max(-1, Math.min(1, (targetY * state.height - entityY) / (state.height * 0.34)));
  const blinkCycle = state.world.time % 6.7;
  const blink = state.reducedMotion || blinkCycle < 6.36
    ? 0
    : Math.sin(((blinkCycle - 6.36) / 0.34) * Math.PI);
  const eye = renderDilenciEye({
    lookX,
    lookY,
    blink,
    dilation: 1 + tension * 0.24,
  }).split('\n');
  const eyeLeft = entityX - eyeWidth / 2;
  const eyeTop = entityY - eyeHeight / 2;

  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 1;

  const living = state.reducedMotion ? 0 : 1;
  const hoodBreath = Math.sin(state.world.time * 0.47) * (compact ? 1.4 : 2.4) * living;
  const hoodWind = (
    Math.sin(state.world.time * 0.29 + 1.1)
    + Math.sin(state.world.time * 0.73) * 0.38
  ) * (compact ? 1.8 : 3.2) * living;

  if (imageReady && state.fisherImage) {
    // The rod stays optically stable while the hood is redrawn in horizontal
    // fabric bands. Each band has its own phase, with motion falling to zero
    // at the hem so the cowl remains planted at the waterline.
    const image = state.fisherImage;
    const hoodStartX = FISHER_ART.width * 0.54;
    const bandCount = 28;
    const bandHeight = FISHER_ART.waterY / bandCount;
    const fabricOffset = (vertical: number): { x: number; y: number } => {
      const anchor = Math.max(0, 1 - vertical) ** 1.35;
      return {
        x: (
          Math.sin(state.world.time * 0.78 + vertical * 5.7)
          + Math.sin(state.world.time * 0.31 + vertical * 11.3) * 0.38
        ) * (1.1 + anchor * 3.4) * living,
        y: Math.sin(state.world.time * 0.54 + vertical * 7.1 + 0.8) * anchor * 1.45 * living,
      };
    };

    g.save();
    g.beginPath();
    g.rect(0, 0, state.width, Math.max(0, bankY - 0.5));
    g.clip();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.82 * dim;

    // Left side: empty field, rod, tip, and reel. It breathes only with the
    // whole artwork, preventing the fishing rod from becoming rubbery.
    g.drawImage(
      image,
      0,
      0,
      hoodStartX,
      FISHER_ART.height,
      art.x,
      art.y,
      hoodStartX * art.scaleX,
      art.height,
    );

    // Right side: the generated cloth itself, softly displaced by the wind.
    for (let band = 0; band < bandCount; band++) {
      const sourceY = band * bandHeight;
      const vertical = sourceY / FISHER_ART.waterY;
      const wind = fabricOffset(vertical);
      g.drawImage(
        image,
        hoodStartX - 2,
        sourceY,
        FISHER_ART.width - hoodStartX + 2,
        bandHeight + 1.5,
        art.x + (hoodStartX - 2) * art.scaleX + wind.x,
        art.y + sourceY * art.scaleY + wind.y,
        (FISHER_ART.width - hoodStartX + 2) * art.scaleX + 0.8,
        (bandHeight + 1.5) * art.scaleY + 0.8,
      );
    }

    // Move the generated eye pixels themselves. First erase their original
    // position inside the black opening, then redraw that exact crop offset
    // toward the visitor or hooked letter. No procedural eye is composited.
    const eyeWind = fabricOffset(FISHER_ART.eyeY / FISHER_ART.waterY);
    const rasterEyeX = entityX + eyeWind.x;
    const rasterEyeY = entityY + eyeWind.y;
    const sourceEyeWidth = FISHER_ART.width * 0.19;
    const sourceEyeHeight = FISHER_ART.height * 0.22;
    const drawnEyeWidth = sourceEyeWidth * art.scaleX;
    const drawnEyeHeight = sourceEyeHeight * art.scaleY;
    const glanceX = lookX * Math.max(1.2, drawnEyeWidth * 0.035) * living;
    const glanceY = lookY * Math.max(0.7, drawnEyeHeight * 0.025) * living;
    const rasterBlink = 1 - blink * 0.62;

    g.globalCompositeOperation = 'source-over';
    g.fillStyle = VOID;
    g.globalAlpha = 0.98 * dim;
    g.beginPath();
    g.ellipse(rasterEyeX, rasterEyeY, drawnEyeWidth * 0.53, drawnEyeHeight * 0.49, 0, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.beginPath();
    g.ellipse(rasterEyeX, rasterEyeY, drawnEyeWidth * 0.52, drawnEyeHeight * 0.48, 0, 0, Math.PI * 2);
    g.clip();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.94 * dim;
    g.drawImage(
      image,
      FISHER_ART.eyeX - sourceEyeWidth / 2,
      FISHER_ART.eyeY - sourceEyeHeight / 2,
      sourceEyeWidth,
      sourceEyeHeight,
      rasterEyeX - drawnEyeWidth / 2 + glanceX,
      rasterEyeY - drawnEyeHeight * rasterBlink / 2 + glanceY,
      drawnEyeWidth,
      drawnEyeHeight * rasterBlink,
    );
    g.restore();
    g.restore();
  } else {
  // Loading fallback: a soft monastic cowl that breathes in several
  // unsynchronised layers and is likewise clipped above the water.
  const hoodTopX = entityX - eyeWidth * 0.1 + hoodWind * 0.55;
  const hoodTopY = entityY - eyeHeight * 1.05 - (compact ? 9 : 16) + hoodBreath;
  const hoodLeft = entityX - eyeWidth * 0.78 + hoodWind * 0.18;
  const hoodRight = Math.min(state.width + 12, entityX + eyeWidth * 0.94 + hoodWind);
  const hoodBottom = bankY - 0.75;

  g.save();
  g.beginPath();
  g.rect(0, 0, state.width, Math.max(0, bankY - 0.5));
  g.clip();
  g.fillStyle = BONE_FAINT;
  g.strokeStyle = BONE_DIM;
  g.globalAlpha = (0.06 + Math.sin(state.world.time * 0.41) * 0.008 * living) * dim;
  g.beginPath();
  g.moveTo(hoodLeft, hoodBottom);
  g.bezierCurveTo(
    hoodLeft - eyeWidth * 0.2 + hoodWind * 0.35,
    entityY + eyeHeight * 0.24,
    entityX - eyeWidth * 0.56 + hoodWind * 0.2,
    hoodTopY + eyeHeight * 0.16,
    hoodTopX,
    hoodTopY,
  );
  g.bezierCurveTo(
    entityX + eyeWidth * 0.38 + hoodWind * 0.7,
    hoodTopY + eyeHeight * 0.08 - hoodBreath * 0.3,
    hoodRight + eyeWidth * 0.12,
    entityY - eyeHeight * 0.12 + hoodWind * 0.18,
    hoodRight,
    hoodBottom,
  );
  g.bezierCurveTo(
    entityX + eyeWidth * 0.48 + hoodWind * 0.4,
    hoodBottom - 8 - hoodBreath,
    entityX - eyeWidth * 0.28,
    hoodBottom - 2 + hoodBreath * 0.2,
    hoodLeft,
    hoodBottom,
  );
  g.closePath();
  g.fill();
  g.globalAlpha = 0.25 * dim;
  g.stroke();

  // The face opening is a deep void behind the eye. Its uneven rim makes the
  // hood feel worn rather than geometrically constructed.
  const openingLeft = entityX - eyeWidth * 0.64 + hoodWind * 0.08;
  const openingRight = entityX + eyeWidth * 0.66 + hoodWind * 0.2;
  g.fillStyle = 'rgba(0, 0, 0, 0.72)';
  g.globalAlpha = 0.42 * dim;
  g.beginPath();
  g.moveTo(openingLeft, entityY + eyeHeight * 0.31 + hoodBreath * 0.22);
  g.bezierCurveTo(
    openingLeft + eyeWidth * 0.04,
    entityY - eyeHeight * 0.62,
    entityX - eyeWidth * 0.25,
    hoodTopY + eyeHeight * 0.34,
    hoodTopX + eyeWidth * 0.05,
    hoodTopY + eyeHeight * 0.28,
  );
  g.bezierCurveTo(
    entityX + eyeWidth * 0.38 + hoodWind * 0.3,
    hoodTopY + eyeHeight * 0.34,
    openingRight,
    entityY - eyeHeight * 0.42 + hoodBreath * 0.15,
    openingRight,
    entityY + eyeHeight * 0.32,
  );
  g.bezierCurveTo(entityX + eyeWidth * 0.25, entityY + eyeHeight * 0.7, entityX - eyeWidth * 0.3, entityY + eyeHeight * 0.66, openingLeft, entityY + eyeHeight * 0.31);
  g.closePath();
  g.fill();
  g.strokeStyle = BONE_DIM;
  g.globalAlpha = 0.23 * dim;
  g.stroke();

  // Long fabric currents move at slightly different rates. Their paths are
  // curved and asymmetrical, avoiding the rigid radiating-line look.
  g.strokeStyle = BONE_FAINT;
  g.setLineDash([1, 7]);
  for (let fold = 0; fold < 6; fold++) {
    const side = fold % 2 === 0 ? -1 : 1;
    const depth = (fold + 1) / 6;
    const localSway = Math.sin(state.world.time * (0.31 + fold * 0.045) + fold * 1.37) * (2 + fold * 0.45) * living;
    g.globalAlpha = (0.075 + depth * 0.055) * dim;
    g.beginPath();
    g.moveTo(
      entityX + side * eyeWidth * (0.18 + depth * 0.14),
      entityY + eyeHeight * (0.28 + depth * 0.08),
    );
    g.bezierCurveTo(
      entityX + side * eyeWidth * (0.3 + depth * 0.22) + localSway,
      entityY + eyeHeight * (0.7 + depth * 0.12),
      entityX + side * eyeWidth * (0.36 + depth * 0.32) + hoodWind * depth,
      hoodBottom - eyeHeight * (0.16 + (1 - depth) * 0.22) + localSway * 0.18,
      entityX + side * eyeWidth * (0.42 + depth * 0.4) + hoodWind * depth,
      hoodBottom,
    );
    g.stroke();
  }
  g.setLineDash([]);
  g.restore();
  }

  // Dilenci briefly resolves inside the hood as the same procedural eye used
  // elsewhere on the site. The surrounding field still bears the catch.
  const pullAngle = Math.atan2(hookY - entityY, hookX - entityX);
  g.strokeStyle = BONE_FAINT;
  for (let ring = 0; ring < 3; ring++) {
    const radius = 1 + ring * 0.22;
    g.globalAlpha = (0.095 - ring * 0.018 + tension * 0.055) * (imageReady ? 0.32 : 1) * dim;
    g.setLineDash([1 + ring, 8 + ring * 5]);
    g.beginPath();
    g.ellipse(
      entityX + Math.cos(pullAngle) * tension * (5 + ring * 3),
      entityY + Math.sin(pullAngle) * tension * (2 + ring),
      eyeWidth * 0.58 * radius + tension * 12,
      eyeHeight * 0.61 * radius - tension * 2,
      pullAngle * 0.055,
      0,
      Math.PI * 2,
    );
    g.stroke();
  }
  g.setLineDash([]);

  if (!imageReady) {
    g.font = `${eyeFont}px "JetBrains Mono", "Berkeley Mono", monospace`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const paintEye = (offsetX: number, offsetY: number, alpha: number, color: string): void => {
      g.fillStyle = color;
      g.globalAlpha = alpha * dim;
      for (let row = 0; row < eye.length; row++) {
        g.fillText(eye[row], eyeLeft + offsetX, eyeTop + row * lineHeight + offsetY);
      }
    };
    const shimmer = state.reducedMotion ? 0 : Math.sin(state.world.time * 2.1) * 0.8;
    paintEye(-2.2 + shimmer, 0.7, 0.08, BONE_FAINT);
    paintEye(1.5 - shimmer * 0.4, -0.6, 0.11, BONE_DIM);
    paintEye(0, 0, 0.48 + tension * 0.22, BONE);

    // The loading fallback has its own broken reflection. The generated eye
    // deliberately does not: it remains the only raster eye on screen.
    if (!compact && bankY + eyeHeight * 0.85 < state.height) {
      g.fillStyle = BONE_FAINT;
      g.textAlign = 'left';
      for (let row = 0; row < eye.length; row += 2) {
        const current = Math.sin(state.world.time * 0.72 + row * 1.7) * (3 + row * 0.8);
        g.globalAlpha = Math.max(0.018, 0.09 - row * 0.008) * dim;
        g.fillText(eye[eye.length - 1 - row], eyeLeft + current, bankY + 12 + row * lineHeight * 0.86);
      }
    }
  }

  // A fold of the hood closes around the handle. The rod regains the long,
  // spare silhouette of the first fishing scene and bends with real tension.
  const rodSway = state.reducedMotion ? 0 : Math.sin(state.world.time * 0.83 + 0.6);
  const livingTipX = imageReady ? tipX : tipX + rodSway * (compact ? 0.7 : 1.2);
  const livingTipY = imageReady
    ? tipY
    : tipY + rodSway * (compact ? 1.1 : 1.8) + Math.sin(state.world.time * 0.37) * living;
  g.strokeStyle = BONE_DIM;
  if (!imageReady) {
    const handleX = entityX - eyeWidth * 0.48 + hoodWind * 0.16;
    const handleY = entityY + eyeHeight * 0.52 + hoodBreath * 0.28;
    g.globalAlpha = (0.32 + tension * 0.22) * dim;
    g.beginPath();
    g.moveTo(handleX + (compact ? 12 : 18), handleY + (compact ? 6 : 9));
    g.lineTo(handleX, handleY);
    g.quadraticCurveTo(
      (handleX + livingTipX) / 2 + rodSway * 1.5,
      Math.min(handleY, livingTipY) - (12 - tension * 25) + rodSway,
      livingTipX,
      livingTipY,
    );
    g.stroke();
    g.globalAlpha = 0.24 * dim;
    g.beginPath();
    g.ellipse(handleX + 1, handleY + 1, compact ? 3.5 : 5, compact ? 2.2 : 3, pullAngle * 0.12, 0, Math.PI * 2);
    g.stroke();
  }

  // A small guide ring makes the attachment unambiguous: rod and filament
  // share this exact moving point.
  g.globalAlpha = (imageReady ? 0.16 : 0.3 + tension * 0.2) * dim;
  g.beginPath();
  g.arc(livingTipX, livingTipY, compact ? 1.1 : 1.6, 0, Math.PI * 2);
  g.stroke();

  const lineBreath = state.reducedMotion ? 0 : Math.sin(state.world.time * 0.69 + 2.2) * 1.1;
  const sag = (22 - tension * 18) * (compact ? 0.72 : 1) + lineBreath;
  g.strokeStyle = BONE_DIM;
  g.globalAlpha = (0.18 + tension * 0.28) * dim;
  g.beginPath();
  g.moveTo(livingTipX, livingTipY);
  g.quadraticCurveTo(
    (livingTipX + hookX) / 2 + 7 + lineBreath * 0.35,
    (livingTipY + hookY) / 2 + sag,
    hookX,
    hookY,
  );
  g.stroke();

  const caught = fishingParticle(state);
  if (caught) {
    g.globalAlpha = (0.22 + tension * 0.38) * dim;
    g.beginPath();
    g.moveTo(hookX, hookY);
    g.lineTo(caught.x * state.width, caught.y * state.height);
    g.stroke();
  }

  // A comma is the only hook he would trust.
  g.font = `${compact ? 9 : 12}px "JetBrains Mono", "Berkeley Mono", monospace`;
  g.textAlign = 'center';
  g.fillStyle = BONE_DIM;
  g.globalAlpha = (0.38 + tension * 0.24) * dim;
  g.fillText(',', hookX + 1, hookY + (compact ? 3 : 4));
  g.beginPath();
  g.arc(hookX, hookY - 2, compact ? 0.8 : 1.3, 0, Math.PI * 2);
  g.fill();

  const murmurAge = state.world.time - state.fishing.murmurAt;
  if (state.fishing.murmur && murmurAge >= 0 && murmurAge < 4.2) {
    const fade = Math.min(1, murmurAge / 0.55, (4.2 - murmurAge) / 1.25);
    g.font = '9px "JetBrains Mono", "Berkeley Mono", monospace';
    g.textAlign = 'right';
    g.fillStyle = BONE_DIM;
    g.globalAlpha = fade * 0.42 * dim;
    g.fillText(state.fishing.murmur, entityX - eyeWidth * 0.34, entityY - eyeHeight * 0.72);
  }
  g.restore();
}

function normalizedAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  if (a > Math.PI / 2) a -= Math.PI;
  if (a < -Math.PI / 2) a += Math.PI;
  return Math.max(-0.62, Math.min(0.62, a));
}

function glyphAngle(state: UndertowState, body: GlyphBody, index: number): number {
  const current = body.particles[index];
  const left = body.particles[Math.max(0, index - 1)];
  const right = body.particles[Math.min(body.particles.length - 1, index + 1)];
  if (left === current && right === current) return 0;
  return normalizedAngle(Math.atan2(
    (right.y - left.y) * state.height,
    (right.x - left.x) * state.width,
  ));
}

function drawBodies(state: UndertowState, now: number): void {
  const g = state.graphics;
  const fontSize = Math.max(10, Math.min(13, state.width / 90));
  g.save();
  g.lineWidth = 1;
  for (const body of state.world.bodies) {
    const retireEnd = state.retireAt.get(body.id);
    const retireAlpha = retireEnd == null ? 1 : Math.max(0, Math.min(1, (retireEnd - now) / 1_800));

    for (const c of body.constraints) {
      if (c.kind !== 'spine' || c.broken) continue;
      const a = body.particles[c.a];
      const b = body.particles[c.b];
      const tension = Math.max(0, Math.min(1, (c.strain - 1) / Math.max(0.1, c.breakRatio - 1)));
      g.beginPath();
      g.moveTo(a.x * state.width, a.y * state.height);
      g.lineTo(b.x * state.width, b.y * state.height);
      g.strokeStyle = tension > 0.55 ? BONE_DIM : BONE_FAINT;
      g.globalAlpha = body.opacity * retireAlpha * (0.15 + tension * 0.42);
      g.stroke();
    }

    g.font = `${fontSize}px "JetBrains Mono", "Berkeley Mono", monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < body.particles.length; i++) {
      const p = body.particles[i];
      if (p.glyph === ' ') continue;
      const surface = sampleSurface(state.world, p.x);
      const submerged = p.y > surface;
      const depth = submerged ? Math.max(0, (p.y - surface) / Math.max(0.01, 1 - surface)) : 0;
      let alpha = submerged ? 0.48 - depth * 0.22 : 0.92;
      if (state.world.breathing > 0 && submerged) {
        alpha += state.world.breathing * (0.48 + depth * 0.22);
      }
      g.save();
      g.translate(p.x * state.width, p.y * state.height);
      g.rotate(glyphAngle(state, body, i));
      if (!submerged) {
        g.fillStyle = BONE;
      } else {
        const base = depth > 0.48 ? [58, 57, 53] : [136, 133, 124];
        const breath = state.world.breathing;
        const red = Math.round(base[0] + (232 - base[0]) * breath);
        const green = Math.round(base[1] + (230 - base[1]) * breath);
        const blue = Math.round(base[2] + (223 - base[2]) * breath);
        g.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      }
      g.globalAlpha = Math.max(0.08, alpha) * body.opacity * retireAlpha;
      g.fillText(p.glyph, 0, 0);
      g.restore();
    }
  }
  g.restore();
}

function drawTether(state: UndertowState): void {
  const particle = state.pointer.particle;
  const tether = state.world.tether;
  if (!particle || !tether || !state.pointer.down) return;
  const g = state.graphics;
  const x = particle.x * state.width;
  const y = particle.y * state.height;
  const targetX = tether.targetX * state.width;
  const targetY = tether.targetY * state.height;
  g.save();
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo((x + targetX) / 2, Math.min(y, targetY) - 6, targetX, targetY);
  g.strokeStyle = BONE_DIM;
  g.globalAlpha = 0.24;
  g.lineWidth = 1;
  g.setLineDash([1, 5]);
  g.stroke();
  g.beginPath();
  g.arc(targetX, targetY, 2.5, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

function drawImpacts(state: UndertowState): void {
  const g = state.graphics;
  g.save();
  g.strokeStyle = BONE_DIM;
  g.lineWidth = 1;
  for (const impact of state.world.impacts) {
    const fade = Math.max(0, 1 - impact.age / (impact.kind === 'surface' ? 1.2 : 2.2));
    if (fade <= 0) continue;
    const x = impact.x * state.width;
    const y = impact.y * state.height;
    g.globalAlpha = fade * (impact.kind === 'surface' ? 0.32 : 0.46);
    if (impact.kind === 'surface') {
      g.beginPath();
      g.ellipse(x, y, 3 + impact.age * 14, 1 + impact.age * 3, 0, 0, Math.PI * 2);
      g.stroke();
    } else {
      const size = 2 + impact.age * 3;
      g.beginPath();
      g.moveTo(x - size, y - size); g.lineTo(x + size, y + size);
      g.moveTo(x + size, y - size); g.lineTo(x - size, y + size);
      g.stroke();
    }
  }
  g.restore();
}

function drawMoon(state: UndertowState): void {
  if (state.height < 520) return;
  const tide = lunarTide();
  const g = state.graphics;
  const x = state.width - 42;
  const y = 74;
  const r = 10;
  const terminator = Math.cos(tide.phase * Math.PI * 2);
  g.save();
  g.strokeStyle = BONE_DIM;
  g.globalAlpha = 0.35;
  g.lineWidth = 1;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.ellipse(x, y, Math.max(0.6, Math.abs(terminator) * r), r, 0, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.restore();
}

function render(state: UndertowState, now: number): void {
  const g = state.graphics;
  const elapsed = now - state.openedAt;
  g.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  g.fillStyle = VOID;
  g.globalAlpha = 1;
  g.fillRect(0, 0, state.width, state.height);
  drawSilt(state);
  drawSurface(state, elapsed);
  drawDilenci(state);
  drawBodies(state, now);
  drawTether(state);
  drawImpacts(state);
  drawMoon(state);
}

function updateReadout(state: UndertowState, now: number): void {
  if (now - state.lastReadoutAt < 750) return;
  state.lastReadoutAt = now;
  const tide = lunarTide();
  state.readout.textContent = `${moonName(tide.phase)} moon · ${Math.round(tide.illumination * 100)}%\ntide ${tide.direction}`;
  const sentences = state.world.bodies
    .filter((body) => !state.retireAt.has(body.id))
    .map((body) => body.text);
  const fisherDescription = state.fisherVisible
    ? 'A hooded Dilenci eye hovers downstream, holding a fishing rod whose comma-shaped line passes through the letters. '
    : '';
  const mirrorText = sentences.length
    ? `${fisherDescription}Sentences currently in the water: ${sentences.join('. ')}`
    : `${fisherDescription}The water is waiting for a sentence.`;
  if (mirrorText !== state.lastMirrorText) {
    state.lastMirrorText = mirrorText;
    state.mirror.textContent = mirrorText;
  }
}

function updateRetiring(state: UndertowState, now: number): void {
  for (const [id, end] of state.retireAt) {
    if (now < end) continue;
    const body = state.world.bodies.find((candidate) => candidate.id === id);
    if (body) removePhrase(state, body);
    else state.retireAt.delete(id);
  }
}

function laneIsReady(state: UndertowState, laneY: number): boolean {
  const bodies = state.world.bodies.filter((body) => body.stream?.laneY === laneY
    && !state.retireAt.has(body.id));
  return bodies.every((body) => Math.min(...body.particles.map((particle) => particle.x)) > 0.08);
}

function updateSentenceCurrent(state: UndertowState, now: number): void {
  const heldBodyId = state.pointer.particle?.bodyId;
  const caughtBodyId = state.fishing.caughtBodyId;
  for (const body of [...state.world.bodies]) {
    if (!body.stream || body.id === heldBodyId || body.id === caughtBodyId || state.retireAt.has(body.id)) continue;
    const minX = Math.min(...body.particles.map((particle) => particle.x));
    const maxX = Math.max(...body.particles.map((particle) => particle.x));
    const leftLost = body.streamAge > 10 && maxX < -0.5;
    if (minX > 1.06 || leftLost) {
      removePhrase(state, body);
    } else if (body.streamAge > 58) {
      beginRetirement(state, body, now);
    }
  }

  if (state.reducedMotion || now < state.nextStreamAt) return;
  const living = state.world.bodies.filter((body) => !state.retireAt.has(body.id));
  if (living.length >= MAX_BODIES) {
    state.nextStreamAt = now + 650;
    return;
  }

  const queued = state.queue[0];
  const firstLane = queued?.preferredLane ?? state.laneCursor;
  for (let attempt = 0; attempt < STREAM_LANES.length; attempt++) {
    const laneIndex = (firstLane + attempt) % STREAM_LANES.length;
    const lane = STREAM_LANES[laneIndex];
    if (!laneIsReady(state, lane)) continue;
    const seed = queued
      ? state.queue.shift()!.seed
      : state.seedIndex < state.seeds.length
        ? state.seeds[state.seedIndex++]
        : { text: state.language.next(), source: 'curated' as const, age: 8 };
    spawnPhrase(state, seed, { lane, fromLeft: true });
    state.laneCursor = laneIndex + 1;
    state.nextStreamAt = now + 1_800 + state.world.rng() * 1_000;
    return;
  }
  state.nextStreamAt = now + 500;
}

function returnIncomplete(state: UndertowState, force = false): void {
  if (state.returned || state.world.bodies.length === 0) return;
  const eligible = state.world.bodies
    .filter((body) => body.source !== 'visitor'
      && body.id !== state.pointer.particle?.bodyId
      && body.id !== state.fishing.caughtBodyId
      && !state.retireAt.has(body.id))
    .map((body) => ({
      body,
      depth: body.particles.reduce((sum, particle) => sum + particle.y, 0) / body.particles.length,
    }))
    .sort((a, b) => b.depth - a.depth);
  const deepest = eligible[0];
  if (!deepest || (!force && deepest.depth < 0.82)) return;
  const source = deepest.body;
  const words = source.text.split(/\s+/).filter(Boolean);
  if (words.length < 3) { state.returned = true; return; }
  let missingIndex = 0;
  for (let i = 1; i < words.length; i++) if (words[i].length > words[missingIndex].length) missingIndex = i;
  const missing = words[missingIndex];
  words[missingIndex] = '···';
  const sourceLane = source.stream?.laneY ?? STREAM_LANES[0];
  const sourceLaneIndex = Math.max(0, STREAM_LANES.findIndex((lane) => lane === sourceLane));
  removePhrase(state, source);
  state.queue.unshift({
    seed: { text: missing, source: source.source, age: source.age + 40 },
    preferredLane: (sourceLaneIndex + 2) % STREAM_LANES.length,
  });
  state.queue.unshift({
    seed: { text: words.join(' '), source: source.source, age: source.age + 40 },
    preferredLane: sourceLaneIndex,
  });
  state.nextStreamAt = Math.min(state.nextStreamAt, performance.now() + 120);
  state.returned = true;
  showNote(state, 'it returned with a gap.');
}

function simulationStep(state: UndertowState): void {
  const tide = lunarTide();
  state.world.tideOffset = tide.offset + Math.sin(state.world.time * Math.PI * 2 / 67) * 0.0025;
  if (tide.direction !== 'slack') state.world.flowDirection = tide.direction === 'rising' ? 1 : -1;
  stepWorld(state.world, FIXED_DT);
  updateFishing(state, FIXED_DT);
  updateSilt(state, FIXED_DT);
}

function frame(now: number): void {
  const state = active;
  if (!state || state.closed) return;
  const elapsed = now - state.openedAt;

  const directManipulation = state.reducedMotion && state.pointer.down && state.pointer.particle != null;
  if (!state.hidden && (!state.reducedMotion || directManipulation)) {
    const frameDt = Math.min(0.05, Math.max(0, (now - state.lastFrameAt) / 1000));
    state.accumulator = Math.min(FIXED_DT * 3, state.accumulator + frameDt);
    let steps = 0;
    while (state.accumulator >= FIXED_DT && steps < 3) {
      simulationStep(state);
      state.accumulator -= FIXED_DT;
      steps += 1;
    }
  }
  state.lastFrameAt = now;
  updateSentenceCurrent(state, now);

  if (!state.reducedMotion && !state.returned && elapsed > 65_000) {
    returnIncomplete(state, elapsed > 90_000);
  }
  if (state.world.fractures > state.lastFractures) {
    state.lastFractures = state.world.fractures;
    showNote(state, 'some words leave first.');
    state.ctx.audio.play('undertow.tide');
  }
  updateRetiring(state, now);
  updateReadout(state, now);
  render(state, now);
  state.raf = requestAnimationFrame(frame);
}

function closeUndertow(): void {
  const state = active;
  if (!state || state.closed) return;
  state.closed = true;
  active = null;
  releaseTether(state.world);
  releaseFishingTether(state.world);
  if (state.raf != null) cancelAnimationFrame(state.raf);
  if (state.noteTimer != null) clearTimeout(state.noteTimer);
  for (const id of state.timers) clearTimeout(id);
  state.abort.abort();
  state.resizeObserver?.disconnect();
  state.overlay.remove();
  state.ctx.events.emit('shell:modal-ended', { name: 'undertow' });
  state.ctx.println('undertow: the water went on.');
  if (state.released > 0) state.ctx.void.whisper('kept');
  const input = document.querySelector('.terminal__input');
  if (input instanceof HTMLElement) input.focus();
}

function makeOverlay(fisherVisible: boolean): {
  overlay: HTMLDivElement;
  canvas: HTMLCanvasElement;
  intro: HTMLDivElement;
  readout: HTMLDivElement;
  composeLine: HTMLDivElement;
  note: HTMLDivElement;
  live: HTMLDivElement;
  mirror: HTMLDivElement;
  close: HTMLButtonElement;
} {
  const overlay = document.createElement('div');
  overlay.className = 'undertow-overlay';
  overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'undertow-title');
  overlay.setAttribute('aria-describedby', 'undertow-description undertow-instructions undertow-contents');

  const canvas = document.createElement('canvas');
  canvas.className = 'undertow-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.textContent = fisherVisible
    ? 'A simulated sea carrying articulated sentences. A hooded, responsive Dilenci eye fishes for their letters with a bending rod downstream.'
    : 'A simulated sea carrying articulated sentences.';

  const intro = document.createElement('div');
  intro.className = 'undertow-intro';
  const title = document.createElement('span');
  title.id = 'undertow-title';
  title.className = 'undertow-title';
  title.textContent = 'undertow';
  const subtitle = document.createElement('span');
  subtitle.id = 'undertow-description';
  subtitle.className = 'undertow-subtitle';
  subtitle.textContent = fisherVisible
    ? 'some sentences do not leave.\nthey learn to float.\ndilenci is waiting downstream.'
    : 'some sentences do not leave.\nthey learn to float.';
  intro.append(title, subtitle);

  const readout = document.createElement('div');
  readout.className = 'undertow-tide-readout';
  readout.setAttribute('aria-hidden', 'true');

  const close = document.createElement('button');
  close.className = 'undertow-close';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'leave undertow');

  const compose = document.createElement('div');
  compose.className = 'undertow-compose';
  const composeLine = document.createElement('div');
  composeLine.className = 'undertow-compose__line';
  composeLine.setAttribute('role', 'textbox');
  composeLine.setAttribute('aria-label', 'an unsaid sentence');
  composeLine.setAttribute('aria-multiline', 'false');
  const composeInstruction = document.createElement('span');
  composeInstruction.className = 'undertow-compose__instruction';
  composeInstruction.textContent = 'enter gives it weight    esc keeps it unsaid';
  compose.append(composeLine, composeInstruction);

  const hint = document.createElement('div');
  hint.id = 'undertow-instructions';
  hint.className = 'undertow-hint';
  hint.textContent = 'type to add    pull a letter    stir the water    hold space to read below    esc leaves';

  const note = document.createElement('div');
  note.className = 'undertow-note';

  const live = document.createElement('div');
  live.className = 'undertow-sr';
  live.setAttribute('aria-live', 'polite');

  const mirror = document.createElement('div');
  mirror.id = 'undertow-contents';
  mirror.className = 'undertow-sr';

  overlay.append(canvas, intro, readout, close, compose, hint, note, live, mirror);
  return { overlay, canvas, intro, readout, composeLine, note, live, mirror, close };
}

function openUndertow(ctx: ProgramContext): void {
  if (active) return;
  const fisherVisible = ctx.dilenci.status()?.silenced !== true;
  const dom = makeOverlay(fisherVisible);
  const graphics = dom.canvas.getContext('2d');
  if (!graphics) {
    ctx.println('undertow: this browser has no water.');
    ctx.events.emit('shell:modal-ended', { name: 'undertow' });
    return;
  }

  const today = new Date();
  const daySeed = hashText(`${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`);
  const archive = readArchive(ctx);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const world = createWorld({ seed: daySeed ^ hashText(archive.join('|')), surfaceY: 0.315, surfacePoints: reducedMotion ? 56 : 112 });
  const abort = new AbortController();
  const now = performance.now();
  const fisherImage = fisherVisible ? new Image() : null;
  if (fisherImage) {
    fisherImage.decoding = 'async';
    fisherImage.src = dilenciFisherImageUrl;
  }
  const state: UndertowState = {
    ctx,
    overlay: dom.overlay,
    canvas: dom.canvas,
    graphics,
    intro: dom.intro,
    readout: dom.readout,
    composeLine: dom.composeLine,
    note: dom.note,
    live: dom.live,
    mirror: dom.mirror,
    close: dom.close,
    world,
    seeds: buildSeeds(ctx, archive, daySeed),
    seedIndex: 0,
    language: createLanguageCurrent(daySeed ^ hashText(archive.join('|')) ^ 0x75_6e_73_61),
    queue: [],
    laneCursor: 0,
    nextStreamAt: now + 1_500,
    silt: createSilt(world, reducedMotion),
    pointer: {
      x: 0.5,
      y: 0.5,
      lastX: 0.5,
      lastY: 0.5,
      down: false,
      water: false,
      particle: null,
      pointerId: null,
    },
    fishing: {
      phase: reducedMotion ? 'waiting' : 'lowering',
      phaseStarted: 0,
      laneIndex: daySeed % STREAM_LANES.length,
      hookX: 0.68,
      hookY: STREAM_LANES[daySeed % STREAM_LANES.length],
      startX: 0.68,
      startY: 0.22,
      caughtParticleId: null,
      caughtBodyId: null,
      overTension: 0,
      catches: 0,
      murmur: '',
      murmurAt: -100,
      announcedCatch: false,
      announcedRelease: false,
      catchAfter: FISHING_FIRST_CATCH_AFTER,
    },
    fisherVisible,
    fisherImage,
    archive,
    writing: false,
    buffer: '',
    released: 0,
    lastFractures: 0,
    returned: false,
    openedAt: now,
    lastFrameAt: now,
    accumulator: 0,
    width: 1,
    height: 1,
    dpr: 1,
    reducedMotion,
    hidden: document.hidden,
    raf: null,
    abort,
    resizeObserver: null,
    timers: [],
    noteTimer: null,
    retireAt: new Map(),
    lastReadoutAt: 0,
    lastMirrorText: '',
    closed: false,
  };
  const initialFisherDescription = fisherVisible ? 'A hooded, responsive Dilenci eye is fishing downstream with a bending rod. ' : '';
  state.lastMirrorText = `${initialFisherDescription}Sentences waiting below: ${state.seeds.map((seed) => seed.text).join('. ')}`;
  dom.mirror.textContent = state.lastMirrorText;
  const initialX = reducedMotion ? [0.2, 0.4, 0.6, 0.8] : [0.08, 0.34, 0.6, 0.86];
  const initialCount = Math.min(STREAM_LANES.length, state.seeds.length);
  for (let i = 0; i < initialCount; i++) {
    spawnPhrase(state, state.seeds[i], {
      x: initialX[i],
      y: STREAM_LANES[i],
      lane: STREAM_LANES[i],
    });
  }
  state.seedIndex = initialCount;
  active = state;
  document.body.appendChild(dom.overlay);
  resizeCanvas(state);
  state.fishing.laneIndex = chooseFishingLane(state);
  const initialRod = fisherGeometry(state);
  if (reducedMotion) {
    const hook = restingHook(state);
    state.fishing.hookX = hook.x;
    state.fishing.hookY = hook.y;
  } else {
    state.fishing.hookX = initialRod.rodTipX;
    state.fishing.hookY = initialRod.rodTipY;
    state.fishing.startX = initialRod.rodTipX;
    state.fishing.startY = initialRod.rodTipY;
  }
  updateCompose(state);

  const keydown = (e: KeyboardEvent) => {
    if (!handleKeyDown(state, e)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const keyup = (e: KeyboardEvent) => {
    if (!handleKeyUp(state, e)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  document.addEventListener('keydown', keydown, { capture: true, signal: abort.signal });
  document.addEventListener('keyup', keyup, { capture: true, signal: abort.signal });
  dom.canvas.addEventListener('pointerdown', (e) => onPointerDown(state, e), { signal: abort.signal });
  dom.canvas.addEventListener('pointermove', (e) => onPointerMove(state, e), { signal: abort.signal });
  dom.canvas.addEventListener('pointerup', (e) => releasePointer(state, e), { signal: abort.signal });
  dom.canvas.addEventListener('pointercancel', (e) => releasePointer(state, e), { signal: abort.signal });
  dom.canvas.addEventListener('lostpointercapture', (e) => {
    if (state.pointer.pointerId === e.pointerId) releasePointer(state);
  }, { signal: abort.signal });
  dom.close.addEventListener('click', () => closeUndertow(), { signal: abort.signal });
  document.addEventListener('visibilitychange', () => {
    state.hidden = document.hidden;
    if (state.hidden) {
      releasePointer(state);
      if (state.world.fishingTether) recoverFishingLine(state);
      setStateBreathing(state, false);
    }
    state.lastFrameAt = performance.now();
    state.accumulator = 0;
  }, { signal: abort.signal });
  window.addEventListener('blur', () => {
    releasePointer(state);
    if (state.world.fishingTether) recoverFishingLine(state);
    setStateBreathing(state, false);
  }, { signal: abort.signal });

  if (typeof ResizeObserver !== 'undefined') {
    state.resizeObserver = new ResizeObserver(() => resizeCanvas(state));
    state.resizeObserver.observe(dom.overlay);
  } else {
    window.addEventListener('resize', () => resizeCanvas(state), { signal: abort.signal });
  }

  const introTimer = window.setTimeout(() => dom.intro.classList.add('is-gone'), 6_500);
  const passiveTimer = window.setTimeout(() => showNote(state, 'you do not have to pull them out.'), 38_000);
  state.timers.push(introTimer, passiveTimer);
  requestAnimationFrame(() => dom.overlay.classList.add('is-open'));
  dom.overlay.focus();
  ctx.audio.play('undertow.enter');
  announce(state, fisherVisible
    ? 'undertow opened. dilenci has become a hooded eye fishing downstream with a rod. type to add a line, pull a letter, stir the water, hold space to read below, escape to leave.'
    : 'undertow opened. type to add a line, pull a letter, stir the water, hold space to read below, escape to leave.');
  state.raf = requestAnimationFrame(frame);

  const supplied = ctx.args.slice(1).join(' ').trim();
  if (supplied && supplied !== '--forget') {
    const id = window.setTimeout(() => releaseLine(state, supplied), 1_900);
    state.timers.push(id);
  }
}

const prog: Program = {
  name: 'undertow',
  aliases: ['below'],
  manpage:
    'undertow ["a line"] — sentences with nowhere else to go.\n' +
    'dilenci waits downstream as a hooded eye with a rod. it is not very good at fishing.\n' +
    'letters can be tethered. pull one and the sentence answers with its body.\n' +
    'type to begin; enter gives the line weight; esc leaves.\n' +
    'recent offerings and lines released here may return. everything stays\n' +
    'in this browser. `undertow --forget` empties only this water.\n' +
    'see also: /var/tides/undertow.log, /dev/harbor, the regret.',
  category: 'art',
  mode: 'modal',
  overlaySelector: '.undertow-overlay',
  init: (ctx) => {
    if (ctx.args[1] === '--forget') {
      try { ctx.fs.write(ARCHIVE_PATH, ''); } catch { /* */ }
      ctx.println('undertow: this water is empty. for now.');
      ctx.events.emit('shell:modal-ended', { name: 'undertow' });
      return;
    }
    openUndertow(ctx);
  },
  // The artwork owns document-level key capture so typing can become material
  // without feeding the terminal input. Kept for the modal registry contract.
  onKey: () => {},
  render: () => {},
  cleanup: () => closeUndertow(),
};

export default prog;
