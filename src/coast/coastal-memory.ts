export const COASTAL_MEMORY_KEY = 'theorkan.coastal-memory.v1';

export type CoastalWeather = 'clear' | 'mist' | 'rain' | 'storm' | 'absence';
export type PhraseSource = 'terminal' | 'undertow' | 'dilenci' | 'radio' | 'studio' | 'shore';

export interface CoastalPhrase {
  text: string;
  source: PhraseSource;
  at: number;
  rescued: boolean;
}

export interface CoastalFootprint {
  col: number;
  row: number;
  at: number;
}

export interface CoastalMemory {
  version: 1;
  seed: number;
  createdAt: number;
  updatedAt: number;
  sessionCount: number;
  commandCount: number;
  phrases: CoastalPhrase[];
  artifacts: string[];
  frequencies: string[];
  footprints: CoastalFootprint[];
  lighthousePasses: number;
  followerSightings: number;
  eyeSightings: number;
  impossibleRoomSeen: boolean;
  absenceSeen: boolean;
  portraitCount: number;
  departedAt: number | null;
}

export interface CoastalSnapshot {
  memory: CoastalMemory;
  tide: number;
  tideName: 'low' | 'rising' | 'high' | 'falling';
  weather: CoastalWeather;
  windDegrees: number;
  windSpeed: number;
  lighthouse: number;
  departureReady: boolean;
  missingDepartureArtifacts: string[];
}

const REQUIRED_ARTIFACTS = [
  'rescued-line',
  'radio-frequency',
  'undertow-line',
  'studio-image',
  'stowaway-name',
] as const;

function seedFromNow(now: number): number {
  let value = (now ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

export function freshCoastalMemory(now = Date.now()): CoastalMemory {
  return {
    version: 1,
    seed: seedFromNow(now),
    createdAt: now,
    updatedAt: now,
    sessionCount: 0,
    commandCount: 0,
    phrases: [],
    artifacts: [],
    frequencies: [],
    footprints: [],
    lighthousePasses: 0,
    followerSightings: 0,
    eyeSightings: 0,
    impossibleRoomSeen: false,
    absenceSeen: false,
    portraitCount: 0,
    departedAt: null,
  };
}

function finiteInt(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : fallback;
}

export function restoreCoastalMemory(value: unknown, now = Date.now()): CoastalMemory {
  if (!value || typeof value !== 'object') return freshCoastalMemory(now);
  const candidate = value as Partial<CoastalMemory>;
  const base = freshCoastalMemory(now);
  const phrases = Array.isArray(candidate.phrases)
    ? candidate.phrases.filter((phrase): phrase is CoastalPhrase => (
      Boolean(phrase && typeof phrase.text === 'string' && typeof phrase.source === 'string')
    )).slice(-48).map((phrase) => ({
      text: phrase.text.replace(/\s+/g, ' ').trim().slice(0, 180),
      source: phrase.source,
      at: Number.isFinite(phrase.at) ? phrase.at : now,
      rescued: Boolean(phrase.rescued),
    }))
    : [];
  const artifacts = Array.isArray(candidate.artifacts)
    ? [...new Set(candidate.artifacts.filter((item): item is string => typeof item === 'string'))].slice(-32)
    : [];
  const frequencies = Array.isArray(candidate.frequencies)
    ? [...new Set(candidate.frequencies.filter((item): item is string => typeof item === 'string'))].slice(-16)
    : [];
  const footprints = Array.isArray(candidate.footprints)
    ? candidate.footprints.filter((footprint): footprint is CoastalFootprint => (
      Boolean(footprint && Number.isFinite(footprint.col) && Number.isFinite(footprint.row))
    )).slice(-80).map((footprint) => ({
      col: Math.floor(footprint.col), row: Math.floor(footprint.row),
      at: Number.isFinite(footprint.at) ? footprint.at : now,
    }))
    : [];
  return {
    ...base,
    seed: finiteInt(candidate.seed, base.seed) >>> 0,
    createdAt: Number.isFinite(candidate.createdAt) ? candidate.createdAt as number : now,
    updatedAt: Number.isFinite(candidate.updatedAt) ? candidate.updatedAt as number : now,
    sessionCount: finiteInt(candidate.sessionCount, 1),
    commandCount: finiteInt(candidate.commandCount),
    phrases,
    artifacts,
    frequencies,
    footprints,
    lighthousePasses: finiteInt(candidate.lighthousePasses),
    followerSightings: finiteInt(candidate.followerSightings),
    eyeSightings: finiteInt(candidate.eyeSightings),
    impossibleRoomSeen: Boolean(candidate.impossibleRoomSeen),
    absenceSeen: Boolean(candidate.absenceSeen),
    portraitCount: finiteInt(candidate.portraitCount),
    departedAt: Number.isFinite(candidate.departedAt) ? candidate.departedAt as number : null,
  };
}

export function readCoastalMemory(now = Date.now()): CoastalMemory {
  try {
    const raw = localStorage.getItem(COASTAL_MEMORY_KEY);
    return restoreCoastalMemory(raw ? JSON.parse(raw) : null, now);
  } catch {
    return freshCoastalMemory(now);
  }
}

function publish(memory: CoastalMemory): void {
  try { localStorage.setItem(COASTAL_MEMORY_KEY, JSON.stringify(memory)); } catch { /* private or full */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('coast:changed', { detail: memory }));
  }
}

export function mutateCoastalMemory(
  mutate: (memory: CoastalMemory) => void,
  now = Date.now(),
): CoastalMemory {
  const memory = readCoastalMemory(now);
  mutate(memory);
  memory.updatedAt = now;
  memory.phrases = memory.phrases.slice(-48);
  memory.footprints = memory.footprints.slice(-80);
  publish(memory);
  return memory;
}

export function beginCoastalSession(now = Date.now()): CoastalMemory {
  return mutateCoastalMemory((memory) => { memory.sessionCount += 1; }, now);
}

export function recordCoastalCommand(line: string, now = Date.now()): CoastalMemory {
  return mutateCoastalMemory((memory) => {
    memory.commandCount += 1;
    const text = line.replace(/\s+/g, ' ').trim();
    if (text.length >= 18 && !/^(help|man|clear|ls)\b/i.test(text)) {
      memory.phrases.push({ text: text.slice(0, 180), source: 'terminal', at: now, rescued: false });
    }
  }, now);
}

export function recordCoastalPhrase(
  raw: string,
  source: PhraseSource,
  rescued = false,
  now = Date.now(),
): CoastalMemory {
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, 180);
  if (!text) return readCoastalMemory(now);
  return mutateCoastalMemory((memory) => {
    const existing = memory.phrases.find((phrase) => phrase.text === text);
    if (existing) {
      existing.at = now;
      existing.rescued ||= rescued;
      existing.source = source;
    } else {
      memory.phrases.push({ text, source, at: now, rescued });
    }
    if (rescued && !memory.artifacts.includes('rescued-line')) memory.artifacts.push('rescued-line');
  }, now);
}

export function addCoastalArtifact(id: string, now = Date.now()): CoastalMemory {
  return mutateCoastalMemory((memory) => {
    if (!memory.artifacts.includes(id)) memory.artifacts.push(id);
  }, now);
}

export function recordCoastalFrequency(value: string, now = Date.now()): CoastalMemory {
  return mutateCoastalMemory((memory) => {
    if (!memory.frequencies.includes(value)) memory.frequencies.push(value);
    if (!memory.artifacts.includes('radio-frequency')) memory.artifacts.push('radio-frequency');
  }, now);
}

export function recordCoastalFootprint(col: number, row: number, now = Date.now()): CoastalMemory {
  return mutateCoastalMemory((memory) => {
    const last = memory.footprints[memory.footprints.length - 1];
    if (!last || last.col !== col || last.row !== row) memory.footprints.push({ col, row, at: now });
  }, now);
}

function noise(seed: number, epoch: number): number {
  let value = (seed ^ Math.imul(epoch + 1, 0x45d9f3b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function coastalSnapshot(memory = readCoastalMemory(), now = Date.now()): CoastalSnapshot {
  const tidePhase = ((now - memory.createdAt) / 720_000 + (memory.seed % 997) / 997) * Math.PI * 2;
  const tide = Math.max(0, Math.min(1, 0.5 + Math.sin(tidePhase) * 0.46 + Math.min(0.04, memory.phrases.length * 0.002)));
  const tideDerivative = Math.cos(tidePhase);
  const tideName: CoastalSnapshot['tideName'] = tide < 0.27 ? 'low'
    : tide > 0.73 ? 'high'
      : tideDerivative >= 0 ? 'rising' : 'falling';
  const weatherEpoch = Math.floor((now - memory.createdAt) / 240_000);
  const weatherRoll = noise(memory.seed, weatherEpoch);
  const weather: CoastalWeather = weatherRoll < 0.36 ? 'clear'
    : weatherRoll < 0.63 ? 'mist'
      : weatherRoll < 0.9 ? 'rain' : 'storm';
  const windDegrees = Math.round(noise(memory.seed ^ 0xa53a, weatherEpoch) * 360);
  const windSpeed = Math.round(3 + noise(memory.seed ^ 0x19b7, weatherEpoch) * (weather === 'storm' ? 24 : 11));
  const lighthousePhase = ((now - memory.createdAt) % 78_000) / 78_000;
  const lighthouse = lighthousePhase < 0.08
    ? Math.sin((lighthousePhase / 0.08) * Math.PI)
    : 0;
  const missingDepartureArtifacts = REQUIRED_ARTIFACTS.filter((id) => !memory.artifacts.includes(id));
  return {
    memory, tide, tideName, weather, windDegrees, windSpeed, lighthouse,
    departureReady: missingDepartureArtifacts.length === 0,
    missingDepartureArtifacts,
  };
}

export function markCoastalFlag(
  flag: 'lighthousePasses' | 'followerSightings' | 'eyeSightings' | 'portraitCount',
  now = Date.now(),
): CoastalMemory {
  return mutateCoastalMemory((memory) => { memory[flag] += 1; }, now);
}

export function subscribeCoastalMemory(listener: (memory: CoastalMemory) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<CoastalMemory>).detail);
  window.addEventListener('coast:changed', handler);
  return () => window.removeEventListener('coast:changed', handler);
}
