// Procedural tracks. Each `setup` wires up the Web Audio graph and returns a
// disposer that the engine calls on pause/skip/stop. Compositions are short,
// ambient, and pitched to match theOrkan.OS's tone — slow drones, sparse
// arpeggios, breathing pulses. Nothing that would feel like background music
// on a hold line.

import type { Track } from './engine';

function makeOsc(ctx: AudioContext, freq: number, type: OscillatorType = 'sine'): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function adsr(ctx: AudioContext, gain: GainNode, peak: number, attack: number, release: number): void {
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

// ──────────────────────────────────────────────────────────────────────────
// 1. harbor — slow, low drone with occasional sine ping. 3:00.
// ──────────────────────────────────────────────────────────────────────────
const harbor: Track = {
  name: 'harbor',
  title: 'harbor',
  caption: 'slow water. waiting wind.',
  duration_s: 180,
  setup(ctx, dest) {
    const base = makeOsc(ctx, 87.31);                // F2
    const fifth = makeOsc(ctx, 130.81);              // C3
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.18;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 380;
    lowpass.Q.value = 0.7;

    base.connect(droneGain);
    fifth.connect(droneGain);
    droneGain.connect(lowpass).connect(dest);
    base.start();
    fifth.start();

    // Sparse pings every 8-14 seconds.
    let alive = true;
    const pingTimers: number[] = [];
    function scheduleNextPing(): void {
      if (!alive) return;
      const id = window.setTimeout(() => {
        if (!alive) return;
        const freqs = [261.63, 329.63, 392.00, 523.25];   // C E G C
        const f = freqs[Math.floor(Math.random() * freqs.length)];
        const ping = makeOsc(ctx, f);
        const pg = ctx.createGain();
        ping.connect(pg).connect(dest);
        ping.start();
        adsr(ctx, pg, 0.06, 0.01, 4.5);
        const stopId = window.setTimeout(() => { try { ping.stop(); } catch { /* */ } }, 5_000);
        pingTimers.push(stopId);
        scheduleNextPing();
      }, 8000 + Math.random() * 6000);
      pingTimers.push(id);
    }
    scheduleNextPing();

    return () => {
      alive = false;
      try { base.stop(); fifth.stop(); } catch { /* */ }
      for (const id of pingTimers) clearTimeout(id);
    };
  },
};

// ──────────────────────────────────────────────────────────────────────────
// 2. tuesday — gentle 5-note arpeggio over a soft pad. 2:30.
// ──────────────────────────────────────────────────────────────────────────
const tuesday: Track = {
  name: 'tuesday',
  title: 'tuesday',
  caption: 'mint. a kitchen light.',
  duration_s: 150,
  setup(ctx, dest) {
    const pad = makeOsc(ctx, 220, 'triangle');
    const padG = ctx.createGain();
    padG.gain.value = 0.05;
    const padLP = ctx.createBiquadFilter();
    padLP.type = 'lowpass';
    padLP.frequency.value = 900;
    pad.connect(padG).connect(padLP).connect(dest);
    pad.start();

    // Arpeggio: A minor 7 (A C E G). Repeats every ~1.7s with random rests.
    const notes = [220.00, 261.63, 329.63, 392.00];
    let alive = true;
    let i = 0;
    const timers: number[] = [];
    function nextNote(): void {
      if (!alive) return;
      if (Math.random() < 0.7) {
        const f = notes[i % notes.length];
        const o = makeOsc(ctx, f, 'sine');
        const g = ctx.createGain();
        o.connect(g).connect(dest);
        o.start();
        adsr(ctx, g, 0.09, 0.02, 1.6);
        const sid = window.setTimeout(() => { try { o.stop(); } catch { /* */ } }, 1800);
        timers.push(sid);
      }
      i++;
      const id = window.setTimeout(nextNote, 420 + Math.random() * 220);
      timers.push(id);
    }
    nextNote();

    return () => {
      alive = false;
      try { pad.stop(); } catch { /* */ }
      for (const id of timers) clearTimeout(id);
    };
  },
};

// ──────────────────────────────────────────────────────────────────────────
// 3. salt — filtered noise sweep. 2:40.
// ──────────────────────────────────────────────────────────────────────────
const salt: Track = {
  name: 'salt',
  title: 'salt',
  caption: 'grainy. wind on the lens.',
  duration_s: 160,
  setup(ctx, dest) {
    // Brown noise via a buffer source.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const noiseG = ctx.createGain();
    noiseG.gain.value = 0.10;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 1.5;

    // Slow filter sweep — frequency cycles between 300 and 1400 Hz over 24s.
    const lfo = makeOsc(ctx, 1 / 24, 'sine');
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 500;
    lfo.connect(lfoGain).connect(bp.frequency);
    lfo.start();

    src.connect(noiseG).connect(bp).connect(dest);
    src.start();

    return () => {
      try { src.stop(); lfo.stop(); } catch { /* */ }
    };
  },
};

// ──────────────────────────────────────────────────────────────────────────
// 4. letter — single sine notes, very slow, very quiet. 3:20.
// ──────────────────────────────────────────────────────────────────────────
const letter: Track = {
  name: 'letter',
  title: 'letter',
  caption: 'unsent. one note at a time.',
  duration_s: 200,
  setup(ctx, dest) {
    // Pentatonic D minor — D F G A C. Plays a slow random walk.
    const scale = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66, 349.23];
    let alive = true;
    const timers: number[] = [];
    function nextNote(): void {
      if (!alive) return;
      const f = scale[Math.floor(Math.random() * scale.length)];
      const o = makeOsc(ctx, f, 'sine');
      const g = ctx.createGain();
      o.connect(g).connect(dest);
      o.start();
      adsr(ctx, g, 0.08, 0.6, 5.5);
      const sid = window.setTimeout(() => { try { o.stop(); } catch { /* */ } }, 6500);
      timers.push(sid);
      const wait = 2200 + Math.random() * 2200;
      const id = window.setTimeout(nextNote, wait);
      timers.push(id);
    }
    nextNote();
    return () => {
      alive = false;
      for (const id of timers) clearTimeout(id);
    };
  },
};

// ──────────────────────────────────────────────────────────────────────────
// 5. dilenci_breathing — almost silent. very slow attack/release. 4:00.
// ──────────────────────────────────────────────────────────────────────────
const dilenci_breathing: Track = {
  name: 'dilenci_breathing',
  title: 'dilenci, breathing',
  caption: 'a process pretending to sleep.',
  duration_s: 240,
  setup(ctx, dest) {
    const o = makeOsc(ctx, 65.41, 'sine');           // C2
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(dest);
    o.start();

    // Breath cycle: 4s attack, 4s release. LFO modulating gain.
    const lfo = makeOsc(ctx, 1 / 8, 'sine');
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();

    return () => {
      try { o.stop(); lfo.stop(); } catch { /* */ }
    };
  },
};

export const TRACKS: Track[] = [
  harbor,
  tuesday,
  salt,
  letter,
  dilenci_breathing,
];
