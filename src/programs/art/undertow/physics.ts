// UNDERTOW physics core.
//
// Coordinates are normalized to the viewport (0..1, y grows downward). The
// renderer is deliberately absent from this file so the strange little sea
// can be tested without a browser. Sentence bodies use Verlet particles and
// breakable constraints; the surface is a coupled spring lattice.

export interface Vec2 { x: number; y: number }

export interface SurfacePoint {
  x: number;
  y: number;
  velocity: number;
}

export interface Particle extends Vec2 {
  id: number;
  previousX: number;
  previousY: number;
  glyph: string;
  mass: number;
  radius: number;
  buoyancy: number;
  bodyId: number;
  pinned: boolean;
}

export type ConstraintKind = 'spine' | 'bend';

export interface Constraint {
  a: number;
  b: number;
  restLength: number;
  stiffness: number;
  breakRatio: number;
  kind: ConstraintKind;
  broken: boolean;
  strain: number;
}

export interface GlyphBody {
  id: number;
  text: string;
  particles: Particle[];
  constraints: Constraint[];
  age: number;
  bornAt: number;
  opacity: number;
  source: 'curated' | 'ledger' | 'archive' | 'visitor' | 'regret';
  stream: StreamProfile | null;
  streamAge: number;
}

export interface StreamProfile {
  laneY: number;
  targetY: number;
  speed: number;
}

export interface PointerTether {
  particleId: number;
  targetX: number;
  targetY: number;
}

export interface FishingTether extends PointerTether {
  length: number;
  tension: number;
}

export interface Vortex extends Vec2 {
  strength: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface Impact extends Vec2 {
  energy: number;
  age: number;
  kind: 'surface' | 'fracture';
}

export interface World {
  time: number;
  surfaceY: number;
  tideOffset: number;
  surface: SurfacePoint[];
  bodies: GlyphBody[];
  vortices: Vortex[];
  impacts: Impact[];
  gravity: number;
  flowDirection: 1 | -1;
  breathing: number;
  breathingTarget: number;
  tether: PointerTether | null;
  fishingTether: FishingTether | null;
  fractures: number;
  rng: () => number;
  nextBodyId: number;
  nextParticleId: number;
}

export interface WorldOptions {
  seed?: number;
  surfaceY?: number;
  surfacePoints?: number;
  gravity?: number;
}

export interface GlyphBodyOptions {
  text?: string;
  glyph?: string;
  x: number;
  y: number;
  velocityX?: number;
  velocityY?: number;
  buoyancy?: number;
  spacing?: number;
  brittleness?: number;
  age?: number;
  opacity?: number;
  source?: GlyphBody['source'];
  stream?: StreamProfile;
}

const MAX_FRAME_DT = 0.05;
const MAX_SUBSTEP = 1 / 120;
const SOLVER_PASSES = 6;
const MAX_VORTICES = 24;
const TETHER_STIFFNESS = 360;
const TETHER_DAMPING = 44;
const TETHER_MAX_ACCELERATION = 90;
const FISHING_STIFFNESS = 96;
const FISHING_DAMPING = 19;
const FISHING_MAX_ACCELERATION = 34;
const TWO_PI = Math.PI * 2;
const MEMORY_WORDS = new Set(['salt', 'harbor', 'tuesday', 'dog', 'kettle', 'stay', 'name']);
const TENDON_WORDS = new Set(['and', 'but', 'because']);
const WORD_GLYPH = /[\p{L}\p{N}]/u;

interface WordRange {
  start: number;
  end: number;
  text: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(a: number, b: number, n: number): number {
  const t = clamp((n - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function createRng(seed = 0x6f726b61): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

export function createWorld(options: WorldOptions = {}): World {
  const surfaceY = options.surfaceY ?? 0.315;
  const count = Math.max(32, Math.floor(options.surfacePoints ?? 112));
  const surface: SurfacePoint[] = Array.from({ length: count }, (_, i) => ({
    x: i / (count - 1),
    y: surfaceY,
    velocity: 0,
  }));
  return {
    time: 0,
    surfaceY,
    tideOffset: 0,
    surface,
    bodies: [],
    vortices: [],
    impacts: [],
    gravity: options.gravity ?? 0.29,
    flowDirection: 1,
    breathing: 0,
    breathingTarget: 0,
    tether: null,
    fishingTether: null,
    fractures: 0,
    rng: createRng(options.seed),
    nextBodyId: 1,
    nextParticleId: 1,
  };
}

function punctuation(ch: string): boolean {
  return /[.,;:!?—-]/.test(ch);
}

function lexicalRanges(text: string): WordRange[] {
  const ranges: WordRange[] = [];
  const glyphs = [...text];
  let start = -1;
  for (let i = 0; i <= glyphs.length; i++) {
    if (i < glyphs.length && WORD_GLYPH.test(glyphs[i])) {
      if (start < 0) start = i;
      continue;
    }
    if (start >= 0) {
      ranges.push({
        start,
        end: i,
        text: glyphs.slice(start, i).join('').toLocaleLowerCase('en'),
      });
      start = -1;
    }
  }
  return ranges;
}

function constraintProfile(
  left: string,
  right: string,
  brittleness: number,
  tendon: boolean,
  withinWord: boolean,
): {
  stiffness: number; breakRatio: number;
} {
  const hasSpace = left === ' ' || right === ' ';
  const hasPunctuation = punctuation(left) || punctuation(right);
  if (tendon) {
    return { stiffness: 0.4, breakRatio: lerp(3.65, 2.8, brittleness) };
  }
  if (withinWord) {
    return { stiffness: 0.92, breakRatio: Number.POSITIVE_INFINITY };
  }
  if (hasPunctuation) {
    return { stiffness: 0.34, breakRatio: lerp(1.72, 1.28, brittleness) };
  }
  if (hasSpace) {
    return { stiffness: 0.48, breakRatio: lerp(2.05, 1.48, brittleness) };
  }
  return { stiffness: 0.82, breakRatio: lerp(2.55, 1.8, brittleness) };
}

export function createGlyphBody(world: World, options: GlyphBodyOptions): GlyphBody {
  const text = (options.text ?? options.glyph ?? '·').replace(/\s+/g, ' ').slice(0, 92);
  const chars = [...(text || '·')];
  const bodyId = world.nextBodyId++;
  const requestedSpacing = options.spacing ?? 0.013;
  const spacing = chars.length > 1
    ? Math.min(requestedSpacing, 0.78 / (chars.length - 1))
    : requestedSpacing;
  const width = spacing * Math.max(0, chars.length - 1);
  const startX = options.stream
    ? options.x - width / 2
    : clamp(options.x - width / 2, 0.025, Math.max(0.025, 0.975 - width));
  const vx = options.velocityX ?? 0;
  const vy = options.velocityY ?? 0;
  const buoyancy = clamp(options.buoyancy ?? 0.56, 0.05, 1.2);
  const age = Math.max(0, options.age ?? 0);
  const brittleness = clamp((options.brittleness ?? 0) + Math.min(0.45, age / 180), 0, 1);
  const words = lexicalRanges(text);
  const repeatedWords = new Set(world.bodies.flatMap((body) => lexicalRanges(body.text).map((word) => word.text)));
  const finalWord = words.at(-1);
  const wordAt = Array<WordRange | undefined>(chars.length);
  for (const word of words) {
    for (let i = word.start; i < word.end && i < wordAt.length; i++) wordAt[i] = word;
  }

  const particles: Particle[] = chars.map((glyph, i) => {
    const sag = chars.length <= 1 ? 0 : Math.sin((i / (chars.length - 1)) * Math.PI) * 0.008;
    const word = wordAt[i];
    const lexicalMass = word
      ? (1 + Math.min(0.16, word.text.length * 0.012))
        * (repeatedWords.has(word.text) ? 1.16 : 1)
        * (MEMORY_WORDS.has(word.text) ? 1.2 : 1)
        * (word === finalWord ? 1.14 : 1)
      : 1;
    const mass = (glyph === ' ' ? 0.45 : punctuation(glyph) ? 1.35 : 1) * lexicalMass;
    const tokenBuoyancy = word
      ? buoyancy
        - Math.min(0.055, word.text.length * 0.005)
        - (repeatedWords.has(word.text) ? 0.035 : 0)
        - (MEMORY_WORDS.has(word.text) ? 0.05 : 0)
        - (word === finalWord ? 0.045 : 0)
      : buoyancy;
    const x = startX + i * spacing;
    const y = options.y + sag + (world.rng() - 0.5) * 0.0015;
    return {
      id: world.nextParticleId++,
      x,
      y,
      previousX: x - vx / 60,
      previousY: y - vy / 60,
      glyph,
      mass,
      radius: glyph === ' ' ? 0.003 : 0.0055,
      buoyancy: clamp(tokenBuoyancy, 0.05, 1.2),
      bodyId,
      pinned: false,
    };
  });

  const constraints: Constraint[] = [];
  for (let i = 0; i < particles.length - 1; i++) {
    const tendon = words.some((word) => TENDON_WORDS.has(word.text)
      && i >= Math.max(0, word.start - 1)
      && i < Math.min(chars.length - 1, word.end));
    const withinWord = wordAt[i] != null && wordAt[i] === wordAt[i + 1];
    const profile = constraintProfile(chars[i], chars[i + 1], brittleness, tendon, withinWord);
    constraints.push({
      a: i,
      b: i + 1,
      restLength: spacing,
      stiffness: profile.stiffness,
      breakRatio: profile.breakRatio,
      kind: 'spine',
      broken: false,
      strain: 1,
    });
  }
  for (let i = 0; i < particles.length - 2; i++) {
    constraints.push({
      a: i,
      b: i + 2,
      restLength: spacing * 2,
      stiffness: 0.075,
      breakRatio: 4,
      kind: 'bend',
      broken: false,
      strain: 1,
    });
  }

  const body: GlyphBody = {
    id: bodyId,
    text,
    particles,
    constraints,
    age,
    bornAt: world.time - age,
    opacity: clamp(options.opacity ?? 1, 0, 1),
    source: options.source ?? 'curated',
    stream: options.stream ? {
      laneY: clamp(options.stream.laneY, 0.36, 0.9),
      targetY: clamp(options.stream.targetY, 0.36, 0.9),
      speed: clamp(options.stream.speed, 0.015, 0.09),
    } : null,
    streamAge: 0,
  };
  world.bodies.push(body);
  return body;
}

export function removeBody(world: World, bodyOrId: GlyphBody | number): void {
  const id = typeof bodyOrId === 'number' ? bodyOrId : bodyOrId.id;
  const removed = world.bodies.find((body) => body.id === id);
  if (removed && world.tether && removed.particles.some((particle) => particle.id === world.tether?.particleId)) {
    world.tether = null;
  }
  if (removed && world.fishingTether
    && removed.particles.some((particle) => particle.id === world.fishingTether?.particleId)) {
    world.fishingTether = null;
  }
  world.bodies = world.bodies.filter((body) => body.id !== id);
}

export function sampleSurface(world: World, x: number): number {
  const nx = clamp(x, 0, 1) * (world.surface.length - 1);
  const i = Math.floor(nx);
  const j = Math.min(world.surface.length - 1, i + 1);
  return lerp(world.surface[i].y, world.surface[j].y, nx - i);
}

export function disturbSurface(world: World, x: number, amount: number, radius = 0.035): void {
  const r = Math.max(0.004, radius);
  for (const point of world.surface) {
    const d = Math.abs(point.x - x);
    if (d >= r) continue;
    const falloff = 0.5 + 0.5 * Math.cos((d / r) * Math.PI);
    point.velocity += clamp(amount, -0.45, 0.45) * falloff;
  }
}

export function addVortex(
  world: World,
  x: number,
  y: number,
  strength = 0.12,
  radius = 0.16,
  life = 1.4,
): Vortex {
  const vortex = {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    strength,
    radius: Math.max(0.025, radius),
    life: Math.max(0.05, life),
    maxLife: Math.max(0.05, life),
  };
  if (world.vortices.length >= MAX_VORTICES) {
    world.vortices.splice(0, world.vortices.length - MAX_VORTICES + 1);
  }
  world.vortices.push(vortex);
  return vortex;
}

function sampleVortices(world: World, x: number, y: number, breathScale: number): Vec2 {
  let fx = 0;
  let fy = 0;
  for (const vortex of world.vortices) {
    const dx = x - vortex.x;
    const dy = y - vortex.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    if (dist >= vortex.radius) continue;
    const fade = clamp(vortex.life / vortex.maxLife, 0, 1);
    const force = vortex.strength * (1 - dist / vortex.radius) ** 2 * fade * breathScale;
    fx += (-dy / dist) * force;
    fy += (dx / dist) * force;
  }
  return { x: fx, y: fy };
}

export function sampleFlow(world: World, x: number, y: number): Vec2 {
  const surface = sampleSurface(world, x);
  const depth = clamp((y - surface) / Math.max(0.01, 1 - surface), 0, 1);
  const returnLayer = smoothstep(0.18, 0.72, depth);
  const breathScale = 1 - world.breathing * 0.92;
  let fx = world.flowDirection * lerp(0.034, -0.028, returnLayer) * breathScale;
  let fy = Math.sin((x * 2.6 + world.time * 0.045) * TWO_PI) * 0.0035 * breathScale;

  // A broad travelling rip remains in the silt and surface water. Sentence
  // bodies use their own directed current below, so meaning never decides
  // which wall a line becomes trapped against.
  const ripCenter = 0.5 + Math.sin(world.time * 0.075) * 0.23;
  const rip = Math.exp(-((x - ripCenter) ** 2) / 0.009) * smoothstep(0.05, 0.55, depth);
  fy += rip * 0.017 * breathScale;

  const vortex = sampleVortices(world, x, y, breathScale);
  fx += vortex.x;
  fy += vortex.y;
  return { x: fx, y: fy };
}

export function sampleStreamFlow(world: World, x: number, y: number, speed = 0.046): Vec2 {
  const breathScale = 1 - world.breathing * 0.92;
  const verticalDrift = Math.sin((x * 1.7 + world.time * 0.035) * TWO_PI) * 0.0028 * breathScale;
  const vortex = sampleVortices(world, x, y, breathScale);
  return {
    x: Math.max(0.006 * breathScale, speed * breathScale + vortex.x),
    y: verticalDrift + vortex.y,
  };
}

export function setBreathing(world: World, holding: boolean): void {
  world.breathingTarget = holding ? 1 : 0;
}

export function attachTether(world: World, particleId: number, x: number, y: number): void {
  if (world.fishingTether?.particleId === particleId) world.fishingTether = null;
  world.tether = {
    particleId,
    targetX: clamp(x, 0.012, 0.988),
    targetY: clamp(y, 0.04, 0.97),
  };
}

export function moveTether(world: World, x: number, y: number): void {
  if (!world.tether) return;
  world.tether.targetX = clamp(x, 0.012, 0.988);
  world.tether.targetY = clamp(y, 0.04, 0.97);
}

export function releaseTether(world: World): void {
  world.tether = null;
}

export function attachFishingTether(
  world: World,
  particleId: number,
  x: number,
  y: number,
  length = 0.008,
): boolean {
  const exists = world.bodies.some((body) => body.particles.some((particle) => particle.id === particleId));
  if (!exists || world.tether?.particleId === particleId) return false;
  world.fishingTether = {
    particleId,
    targetX: clamp(x, 0.012, 0.988),
    targetY: clamp(y, 0.04, 0.97),
    length: clamp(length, 0, 1),
    tension: 0,
  };
  return true;
}

export function moveFishingTether(world: World, x: number, y: number, length?: number): void {
  if (!world.fishingTether) return;
  world.fishingTether.targetX = clamp(x, 0.012, 0.988);
  world.fishingTether.targetY = clamp(y, 0.04, 0.97);
  if (length != null) world.fishingTether.length = clamp(length, 0, 1);
}

export function releaseFishingTether(world: World): void {
  world.fishingTether = null;
}

export function nearestParticle(world: World, x: number, y: number, maxDistance = 0.045): Particle | null {
  let best: Particle | null = null;
  let bestSq = maxDistance * maxDistance;
  for (const body of world.bodies) {
    for (const particle of body.particles) {
      if (particle.glyph === ' ') continue;
      const dx = particle.x - x;
      const dy = particle.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestSq) { best = particle; bestSq = d; }
    }
  }
  return best;
}

function stepSurface(world: World, dt: number): void {
  const target = world.surfaceY + world.tideOffset;
  const points = world.surface;
  const acceleration = new Array<number>(points.length).fill(0);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    acceleration[i] += (target - p.y) * 33;
    if (i > 0) acceleration[i] += (points[i - 1].y - p.y) * 82;
    if (i < points.length - 1) acceleration[i] += (points[i + 1].y - p.y) * 82;
  }
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    p.velocity += acceleration[i] * dt;
    p.velocity *= Math.exp(-2.25 * dt);
    p.y += p.velocity * dt;
  }
}

function tetherAcceleration(
  particle: Particle,
  tether: PointerTether,
  oldX: number,
  oldY: number,
  dt: number,
  stiffness: number,
  damping: number,
  maxAcceleration: number,
): Vec2 {
  const velocityX = (oldX - particle.previousX) / Math.max(0.0001, dt);
  const velocityY = (oldY - particle.previousY) / Math.max(0.0001, dt);
  let x = ((tether.targetX - oldX) * stiffness - velocityX * damping) / Math.max(0.45, particle.mass);
  let y = ((tether.targetY - oldY) * stiffness - velocityY * damping) / Math.max(0.45, particle.mass);
  const magnitude = Math.sqrt(x * x + y * y);
  if (magnitude > maxAcceleration) {
    const scale = maxAcceleration / magnitude;
    x *= scale;
    y *= scale;
  }
  return { x, y };
}

function fishingAcceleration(
  particle: Particle,
  tether: FishingTether,
  oldX: number,
  oldY: number,
  dt: number,
): Vec2 {
  const dx = tether.targetX - oldX;
  const dy = tether.targetY - oldY;
  const distance = Math.sqrt(dx * dx + dy * dy) || 0.000001;
  const stretch = distance - tether.length;
  if (stretch <= 0) return { x: 0, y: 0 };
  const nx = dx / distance;
  const ny = dy / distance;
  const velocityX = (oldX - particle.previousX) / Math.max(0.0001, dt);
  const velocityY = (oldY - particle.previousY) / Math.max(0.0001, dt);
  const radialVelocity = velocityX * nx + velocityY * ny;
  const raw = (FISHING_STIFFNESS * stretch - FISHING_DAMPING * radialVelocity)
    / Math.max(0.45, particle.mass);
  const acceleration = clamp(raw, 0, FISHING_MAX_ACCELERATION);
  tether.tension = Math.max(tether.tension, acceleration / FISHING_MAX_ACCELERATION);
  return { x: nx * acceleration, y: ny * acceleration };
}

function integrateParticles(world: World, dt: number): void {
  const dragWater = lerp(0.985, 0.86, world.breathing);
  const dragAir = lerp(0.997, 0.91, world.breathing);

  for (const body of world.bodies) {
    body.age += dt;
    body.streamAge += dt;
    let meanY = 0;
    for (const particle of body.particles) meanY += particle.y;
    meanY /= Math.max(1, body.particles.length);

    for (const p of body.particles) {
      if (p.pinned) {
        p.previousX = p.x;
        p.previousY = p.y;
        continue;
      }
      const oldX = p.x;
      const oldY = p.y;
      const oldSurface = sampleSurface(world, oldX);
      const underwater = oldY > oldSurface;
      const drag = underwater ? dragWater : dragAir;
      const flow = body.stream
        ? sampleStreamFlow(world, oldX, oldY, body.stream.speed)
        : sampleFlow(world, oldX, oldY);
      let ax = body.stream ? flow.x * 1.8 : underwater ? flow.x * 1.8 : flow.x * 0.15;
      let ay: number;
      if (body.stream) {
        const motionScale = 1 - world.breathing * 0.85;
        const laneWander = Math.sin(world.time * 0.16 + body.id * 1.7) * 0.006;
        const laneForce = (body.stream.targetY + laneWander - oldY) * 3.2;
        const semanticOffset = -(p.buoyancy - 0.52) * 0.16;
        ay = (flow.y * 1.4 + laneForce + semanticOffset) * motionScale;
      } else {
        ay = world.gravity + (underwater ? flow.y * 1.4 - p.buoyancy * 0.5 : 0);
      }
      if (underwater && world.breathing > 0) {
        ay += (meanY - oldY) * 4.5 * world.breathing;
      }

      if (world.tether?.particleId === p.id) {
        const acceleration = tetherAcceleration(
          p,
          world.tether,
          oldX,
          oldY,
          dt,
          TETHER_STIFFNESS,
          TETHER_DAMPING,
          TETHER_MAX_ACCELERATION,
        );
        ax += acceleration.x;
        ay += acceleration.y;
      }
      if (world.fishingTether?.particleId === p.id && world.tether?.particleId !== p.id) {
        const acceleration = fishingAcceleration(p, world.fishingTether, oldX, oldY, dt);
        ax += acceleration.x;
        ay += acceleration.y;
      }
      const vx = (oldX - p.previousX) * drag;
      const vy = (oldY - p.previousY) * drag;
      p.previousX = oldX;
      p.previousY = oldY;
      p.x = oldX + vx + ax * dt * dt;
      p.y = oldY + vy + ay * dt * dt;

      const newSurface = sampleSurface(world, p.x);
      if ((oldY <= oldSurface) !== (p.y <= newSurface) && Math.abs(vy) > 0.00025) {
        const energy = clamp(vy * 14, -0.12, 0.12);
        disturbSurface(world, p.x, energy, 0.018 + p.mass * 0.003);
        world.impacts.push({ x: p.x, y: newSurface, energy: Math.abs(energy), age: 0, kind: 'surface' });
      }
    }
  }
}

function solveConstraints(world: World): void {
  for (let pass = 0; pass < SOLVER_PASSES; pass++) {
    for (const body of world.bodies) {
      for (const c of body.constraints) {
        if (c.broken) continue;
        if (c.kind === 'bend') {
          // A bend spans two adjacent spine links. Once either link fractures,
          // the hidden stabilizer must go too or the fragments remain tethered.
          const leftSpine = body.constraints[c.a];
          const rightSpine = body.constraints[c.a + 1];
          if (leftSpine?.kind === 'spine' && rightSpine?.kind === 'spine'
            && (leftSpine.broken || rightSpine.broken)) {
            c.broken = true;
            continue;
          }
        }
        const a = body.particles[c.a];
        const b = body.particles[c.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.000001;
        c.strain = dist / c.restLength;
        if (c.kind === 'spine' && body.age > 0.5 && c.strain > c.breakRatio) {
          c.broken = true;
          world.fractures += 1;
          world.impacts.push({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            energy: clamp(c.strain - 1, 0.1, 1),
            age: 0,
            kind: 'fracture',
          });
          continue;
        }
        const invA = a.pinned ? 0 : 1 / a.mass;
        const invB = b.pinned ? 0 : 1 / b.mass;
        const invTotal = invA + invB;
        if (invTotal === 0) continue;
        const correction = ((dist - c.restLength) / dist) * c.stiffness;
        const cx = dx * correction;
        const cy = dy * correction;
        if (!a.pinned) {
          a.x += cx * (invA / invTotal);
          a.y += cy * (invA / invTotal);
        }
        if (!b.pinned) {
          b.x -= cx * (invB / invTotal);
          b.y -= cy * (invB / invTotal);
        }
      }
    }
  }
}

function collide(world: World): void {
  const all: Particle[] = [];
  for (const body of world.bodies) all.push(...body.particles);
  const cellSize = 0.018;
  const grid = new Map<number, Particle[]>();
  for (const p of all) {
    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);
    const key = cx + cy * 128;
    const bucket = grid.get(key);
    if (bucket) bucket.push(p); else grid.set(key, [p]);
  }
  for (const p of all) {
    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const bucket = grid.get(cx + ox + (cy + oy) * 128);
      if (!bucket) continue;
      for (const q of bucket) {
        if (q.id <= p.id || q.bodyId === p.bodyId) continue;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const minDist = p.radius + q.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 <= 0 || d2 >= minDist * minDist) continue;
        const d = Math.sqrt(d2);
        const push = (minDist - d) / d;
        const invP = p.pinned ? 0 : 1 / p.mass;
        const invQ = q.pinned ? 0 : 1 / q.mass;
        const total = invP + invQ;
        if (total === 0) continue;
        if (!p.pinned) {
          p.x -= dx * push * (invP / total) * 0.45;
          p.y -= dy * push * (invP / total) * 0.45;
        }
        if (!q.pinned) {
          q.x += dx * push * (invQ / total) * 0.45;
          q.y += dy * push * (invQ / total) * 0.45;
        }
      }
    }
  }
}

function contain(world: World): void {
  for (const body of world.bodies) {
    for (const p of body.particles) {
      if (p.pinned) continue;
      if (!body.stream && p.x < 0.012) { p.x = 0.012; p.previousX = p.x + Math.abs(p.x - p.previousX) * 0.25; }
      if (!body.stream && p.x > 0.988) { p.x = 0.988; p.previousX = p.x - Math.abs(p.x - p.previousX) * 0.25; }
      if (p.y < 0.04) { p.y = 0.04; p.previousY = p.y; }
      if (p.y > 0.97) { p.y = 0.97; p.previousY = p.y + Math.abs(p.y - p.previousY) * 0.15; }
    }
  }
}

function substep(world: World, dt: number): void {
  world.time += dt;
  world.breathing += (world.breathingTarget - world.breathing) * Math.min(1, dt * 5.5);
  for (const vortex of world.vortices) vortex.life -= dt;
  world.vortices = world.vortices.filter((v) => v.life > 0);
  for (const impact of world.impacts) impact.age += dt;
  world.impacts = world.impacts.filter((impact) => impact.age < 2.5);
  if (world.fishingTether) world.fishingTether.tension = 0;
  stepSurface(world, dt);
  integrateParticles(world, dt);
  solveConstraints(world);
  collide(world);
  contain(world);
}

export function stepWorld(world: World, dtSeconds: number): void {
  const dt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, MAX_FRAME_DT);
  if (dt <= 0) return;
  const count = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
  const subDt = dt / count;
  for (let i = 0; i < count; i++) substep(world, subDt);
}

export function worldIsFinite(world: World): boolean {
  for (const p of world.surface) if (!Number.isFinite(p.y) || !Number.isFinite(p.velocity)) return false;
  for (const body of world.bodies) for (const p of body.particles) {
    if (![p.x, p.y, p.previousX, p.previousY].every(Number.isFinite)) return false;
  }
  if (world.fishingTether && ![
    world.fishingTether.targetX,
    world.fishingTether.targetY,
    world.fishingTether.length,
    world.fishingTether.tension,
  ].every(Number.isFinite)) return false;
  return true;
}
