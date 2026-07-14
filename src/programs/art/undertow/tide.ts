// Lunar clock + semantic weight for UNDERTOW.
//
// This is deliberately not an astronomical tide table. It is a small,
// deterministic cosmology: the real phase of the moon modulates a semidiurnal
// tide, while the language in a sentence decides how readily it floats.

const SYNODIC_MONTH_DAYS = 29.53058867;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
const SEMIDIURNAL_TIDE_MS = 12.42 * 60 * 60 * 1000;

export type TideDirection = 'rising' | 'falling' | 'slack';

export interface LunarTide {
  phase: number;          // 0 new moon, 0.5 full moon, 1 new moon again
  illumination: number;   // 0..1
  springStrength: number; // 0..1, strongest near new/full moons
  offset: number;         // normalized vertical displacement
  velocity: number;       // signed normalized movement
  direction: TideDirection;
}

function unit(n: number): number {
  return ((n % 1) + 1) % 1;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function moonPhase(atMs = Date.now()): number {
  const elapsedDays = (atMs - KNOWN_NEW_MOON_MS) / 86_400_000;
  return unit(elapsedDays / SYNODIC_MONTH_DAYS);
}

export function lunarTide(atMs = Date.now(), polarity: 1 | -1 = 1): LunarTide {
  const phase = moonPhase(atMs);
  const illumination = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  // Spring tides occur around both new and full moons.
  const springStrength = Math.abs(Math.cos(phase * Math.PI * 2));
  const cycle = unit((atMs - KNOWN_NEW_MOON_MS) / SEMIDIURNAL_TIDE_MS + phase * 0.5);
  const angle = cycle * Math.PI * 2;
  const amplitude = 0.004 + springStrength * 0.007;
  const offset = Math.sin(angle) * amplitude * polarity;
  const velocity = Math.cos(angle) * polarity;
  const direction: TideDirection = Math.abs(velocity) < 0.14
    ? 'slack'
    : velocity > 0 ? 'rising' : 'falling';
  return { phase, illumination, springStrength, offset, velocity, direction };
}

export function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const FLOATING_WORDS = /\b(harbor|home|hold|held|stay|stayed|return|remember|warmth|tender|love|boat|shore|dog|sari|sarı)\b/gi;
const SINKING_WORDS = /\b(regret|sorry|never|forgot|forgotten|lost|debt|unsent|left|leaving|missed|nothing|goodbye|empty)\b/gi;

function countMatches(text: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  return [...text.matchAll(pattern)].length;
}

// Returns the upward force multiplier used by the physics world. The mapping
// is intentionally legible as metaphor but never shown to the visitor.
export function semanticBuoyancy(text: string): number {
  const lower = text.toLocaleLowerCase('en');
  const tender = countMatches(lower, FLOATING_WORDS);
  const heavy = countMatches(lower, SINKING_WORDS);
  const punctuationWeight = (lower.match(/[.,;:!?—-]/g) ?? []).length * 0.012;
  const hashedDrift = ((hashText(lower) % 1000) / 999 - 0.5) * 0.12;
  return clamp(0.56 + tender * 0.12 - heavy * 0.15 - punctuationWeight + hashedDrift, 0.18, 0.9);
}

export function moonName(phase: number): string {
  const p = unit(phase);
  if (p < 0.03 || p >= 0.97) return 'new';
  if (p < 0.22) return 'waxing crescent';
  if (p < 0.28) return 'first quarter';
  if (p < 0.47) return 'waxing gibbous';
  if (p < 0.53) return 'full';
  if (p < 0.72) return 'waning gibbous';
  if (p < 0.78) return 'last quarter';
  return 'waning crescent';
}
