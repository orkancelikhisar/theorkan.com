// Local-only browser fingerprinting (§8.12). No network, no third-party APIs.
// Each component reports what it can and contributes an entropy estimate; the
// stowaway sums these into "you are 1 in N" and "I need ~M more bits."
//
// Bit estimates are intentionally modest — Panopticlick-style real-world
// entropy is around 17-22 bits for a typical desktop, not the theoretical
// sum of per-attribute Shannon entropies (many attributes correlate).
//
// All collectors are wrapped in try/catch because every one of these APIs has
// a browser that hides, lies, or throws.

export interface Signature {
  user_agent: string;
  platform: string;
  cpu_cores: string;
  ram: string;
  language: string;
  timezone: string;
  screen: string;
  pixel_ratio: string;
  touch_points: string;
  webgl_renderer: string;
  canvas_hash: string;
  audio_hash: string;
  connection: string;
}

export interface FingerprintResult {
  sig: Signature;
  bits: number;
  similar: number;
  populationOnline: number;
  bitsToFullyPinpoint: number;
}

// Updated ~yearly. Worldwide internet users, rounded down.
export const POPULATION_ONLINE = 5_540_000_000;
const FULL_PINPOINT_BITS = Math.ceil(Math.log2(POPULATION_ONLINE));

const BIT_WEIGHTS: Record<keyof Signature, number> = {
  user_agent:      4,
  platform:        1,
  cpu_cores:       1.5,
  ram:             1,
  language:        2,
  timezone:        3,
  screen:          2.5,
  pixel_ratio:     0.5,
  touch_points:    0.5,
  webgl_renderer:  3,
  canvas_hash:     3.5,
  audio_hash:      2,
  connection:      0.5,
};

const PLACEHOLDER = '—';

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

function readScreen(): string {
  return safe(() => `${screen.width} × ${screen.height} × ${screen.colorDepth}bpp`, PLACEHOLDER);
}

function readWebglRenderer(): string {
  return safe(() => {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return PLACEHOLDER;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return safe(() => String(gl.getParameter(gl.RENDERER) ?? PLACEHOLDER), PLACEHOLDER);
    const renderer = gl.getParameter((ext as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL);
    return String(renderer ?? PLACEHOLDER);
  }, PLACEHOLDER);
}

function readCanvasHash(): string {
  return safe(() => {
    const c = document.createElement('canvas');
    c.width = 220; c.height = 30;
    const ctx = c.getContext('2d');
    if (!ctx) return PLACEHOLDER;
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.fillStyle = '#069';
    ctx.fillText('postmodern · dilenci · 1997', 4, 4);
    ctx.fillStyle = 'rgba(102, 200, 0, 0.7)';
    ctx.fillRect(120, 1, 80, 20);
    return djb2(c.toDataURL());
  }, PLACEHOLDER);
}

async function readAudioHash(): Promise<string> {
  try {
    const Ctx = (globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext
      || (globalThis as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Ctx) return PLACEHOLDER;
    const audio = new Ctx(1, 44100, 44100);
    const osc = audio.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 10_000;
    const comp = audio.createDynamicsCompressor();
    comp.threshold.value = -50;
    comp.knee.value = 40;
    comp.ratio.value = 12;
    comp.attack.value = 0;
    comp.release.value = 0.25;
    osc.connect(comp); comp.connect(audio.destination);
    osc.start(0);
    const buf = await audio.startRendering();
    const data = buf.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
    return djb2(sum.toString());
  } catch { return PLACEHOLDER; }
}

export async function collectSignature(): Promise<Signature> {
  const audio_hash = await readAudioHash();
  return {
    user_agent:     safe(() => navigator.userAgent, PLACEHOLDER),
    platform:       safe(() => (navigator as unknown as { platform: string }).platform, PLACEHOLDER),
    cpu_cores:      safe(() => String(navigator.hardwareConcurrency ?? PLACEHOLDER), PLACEHOLDER),
    ram:            safe(() => {
      const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
      return mem ? `${mem} GB (approx)` : PLACEHOLDER;
    }, PLACEHOLDER),
    language:       safe(() => (navigator.languages?.join(', ') || navigator.language || PLACEHOLDER), PLACEHOLDER),
    timezone:       safe(() => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -new Date().getTimezoneOffset() / 60;
      const sign = offset >= 0 ? '+' : '-';
      return `${tz} (UTC${sign}${Math.abs(offset)})`;
    }, PLACEHOLDER),
    screen:         readScreen(),
    pixel_ratio:    safe(() => String(window.devicePixelRatio ?? PLACEHOLDER), PLACEHOLDER),
    touch_points:   safe(() => String(navigator.maxTouchPoints ?? 0), '0'),
    webgl_renderer: readWebglRenderer(),
    canvas_hash:    readCanvasHash(),
    audio_hash,
    connection:     safe(() => {
      const c = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
      return c?.effectiveType ?? PLACEHOLDER;
    }, PLACEHOLDER),
  };
}

// Estimate entropy contributed by this signature. Each field that has a
// non-placeholder value contributes its full weight; missing fields don't.
// We damp the sum by a correlation factor to land near Panopticlick reality.
const CORRELATION_DAMP = 0.65;

export function estimateBits(sig: Signature): number {
  let raw = 0;
  for (const key of Object.keys(BIT_WEIGHTS) as (keyof Signature)[]) {
    if (sig[key] !== PLACEHOLDER) raw += BIT_WEIGHTS[key];
  }
  return Math.max(1, Math.round(raw * CORRELATION_DAMP * 10) / 10);
}

export async function fingerprint(): Promise<FingerprintResult> {
  const sig = await collectSignature();
  const bits = estimateBits(sig);
  const uniqueness = Math.pow(2, bits);
  const similar = Math.max(1, Math.floor(POPULATION_ONLINE / uniqueness));
  return {
    sig, bits, similar,
    populationOnline: POPULATION_ONLINE,
    bitsToFullyPinpoint: Math.max(0, FULL_PINPOINT_BITS - bits),
  };
}
