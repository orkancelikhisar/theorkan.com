// ZzFX - Zuper Zmall Zound Zynth - Micro Edition
// MIT License - Copyright 2019 Frank Force - https://github.com/KilledByAPixel/ZzFX
let zzfxV = 0.3;
const zzfxR = 44100;
let zzfxX: AudioContext | null = null;

export function setZzfxContext(ctx: AudioContext): void { zzfxX = ctx; }
export function setZzfxVolume(v: number): void { zzfxV = v; }

export function zzfx(...params: number[]): AudioBufferSourceNode | null {
  if (!zzfxX) return null;
  const buffer = zzfxG(...params);
  const source = zzfxX.createBufferSource();
  const audioBuffer = zzfxX.createBuffer(1, buffer.length, zzfxR);
  audioBuffer.getChannelData(0).set(buffer);
  source.buffer = audioBuffer;
  source.connect(zzfxX.destination);
  source.start();
  return source;
}

function zzfxG(
  volume = 1, randomness = 0.05, frequency = 220, attack = 0, sustain = 0,
  release = 0.1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0,
  pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0,
  bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0,
): Float32Array {
  const PI2 = Math.PI * 2;
  const sign = (v: number) => (v > 0 ? 1 : -1);
  let startSlide = (slide *= (500 * PI2) / zzfxR ** 2);
  const startFrequency = frequency * (((1 + randomness * 2 * Math.random() - randomness) * PI2) / zzfxR);
  let freq = startFrequency;
  const b: number[] = [];
  let t = 0, tm = 0, i = 0, j = 1, r = 0, c = 0, s = 0;
  let f, length;
  attack = attack * zzfxR + 9;
  decay *= zzfxR;
  sustain *= zzfxR;
  release *= zzfxR;
  delay *= zzfxR;
  deltaSlide *= (500 * PI2) / zzfxR ** 3;
  modulation *= PI2 / zzfxR;
  pitchJump *= PI2 / zzfxR;
  pitchJumpTime *= zzfxR;
  repeatTime = (repeatTime * zzfxR) | 0;
  for (length = (attack + decay + sustain + release + delay) | 0; i < length; b[i++] = s) {
    if (!(++c % ((bitCrush * 100) | 0 || 1))) {
      s = shape ? shape > 1 ? shape > 2 ? shape > 3 ? Math.sin((t % PI2) ** 3) : Math.max(Math.min(Math.tan(t), 1), -1) : 1 - (((((2 * t) / PI2) % 2) + 2) % 2) : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2) : Math.sin(t);
      s = (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) * sign(s) * Math.abs(s) ** shapeCurve * volume * zzfxV *
        (i < attack ? i / attack : i < attack + decay ? 1 - ((i - attack) / decay) * (1 - sustainVolume) : i < attack + decay + sustain ? sustainVolume : i < length - delay ? ((length - i - delay) / release) * sustainVolume : 0);
      s = delay ? s / 2 + (delay > i ? 0 : ((i < length - delay ? 1 : (length - i) / delay) * b[(i - delay) | 0]) / 2) : s;
    }
    f = (freq += (startSlide += deltaSlide)) * Math.cos(modulation * tm++);
    t += f - f * noise * (1 - (((Math.sin(i) * 1e9) % 2) + 2) % 2);
    if (j && ++j > pitchJumpTime) { freq += pitchJump; j = 0; }
    if (repeatTime && !(++r % repeatTime)) { freq = startFrequency; j = j || 1; }
  }
  return new Float32Array(b);
}
