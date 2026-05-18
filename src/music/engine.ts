// Procedural music engine for theOrkan.OS.
//
// Tracks are JS-defined ambient compositions wired through the Web Audio
// graph. Each `Track.setup(ctx, dest)` returns a `stop()` closure that the
// engine calls on pause/skip/stop. All audio flows through a shared analyser
// so the music panel can render a real-time ASCII waveform.

export interface Track {
  name: string;
  title: string;
  caption?: string;
  duration_s: number;
  setup: (ctx: AudioContext, dest: AudioNode) => () => void;
}

export interface NowPlaying {
  track: Track;
  startedAt: number;
  pauseElapsed: number;
  pausedAt: number | null;
  cleanup: () => void;
}

export interface MusicAPI {
  list(): Track[];
  play(nameOrIndex?: string | number): Track | null;
  pause(): void;
  resume(): void;
  skip(): void;
  prev(): void;
  restart(): void;
  scrubBy(deltaS: number): void;
  stop(): void;
  current(): { track: Track; elapsed: number; duration: number; paused: boolean } | null;
  isPaused(): boolean;
  getAnalyser(): AnalyserNode | null;
  onChange(cb: () => void): () => void;
}

const MASTER_GAIN = 0.4;

export function createMusicEngine(tracks: Track[]): MusicAPI {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let analyser: AnalyserNode | null = null;
  let now: NowPlaying | null = null;
  let endTimer: number | null = null;
  const listeners: Array<() => void> = [];

  function notify(): void { for (const cb of listeners) try { cb(); } catch { /* */ } }

  function ensureCtx(): AudioContext {
    if (!ctx) {
      const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx!();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      master.connect(analyser);
      analyser.connect(ctx.destination);
    }
    // Browsers auto-suspend the AudioContext if it's idle or there's no recent
    // user gesture. Try to resume on every play — if there's no gesture yet
    // this is a no-op but the next user keystroke will land us here again.
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function resetMasterGain(): void {
    if (!ctx || !master) return;
    // Cancel any in-flight ramp from pause/stop so the new track isn't muted.
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(MASTER_GAIN, ctx.currentTime);
  }

  function stopNow(): void {
    if (!now) return;
    try { now.cleanup(); } catch { /* */ }
    now = null;
    if (endTimer != null) { clearTimeout(endTimer); endTimer = null; }
    notify();
  }

  function elapsedMs(): number {
    if (!now) return 0;
    const base = now.pausedAt != null ? now.pausedAt : Date.now();
    return base - now.startedAt - now.pauseElapsed;
  }

  function play(nameOrIndex?: string | number): Track | null {
    const list = tracks;
    let track: Track | undefined;
    if (nameOrIndex == null) {
      track = list[0];
    } else if (typeof nameOrIndex === 'number') {
      track = list[((nameOrIndex % list.length) + list.length) % list.length];
    } else {
      const norm = nameOrIndex.toLowerCase().trim();
      track = list.find((t) => t.name === norm || t.title.toLowerCase() === norm);
    }
    if (!track) return null;
    stopNow();
    const c = ensureCtx();
    // Reset the master gain to default after any prior fade-to-zero so the
    // new track is actually audible.
    resetMasterGain();
    const cleanup = track.setup(c, master!);
    now = {
      track,
      startedAt: Date.now(),
      pauseElapsed: 0,
      pausedAt: null,
      cleanup,
    };
    endTimer = window.setTimeout(() => skip(), track.duration_s * 1000);
    notify();
    return track;
  }

  function pause(): void {
    if (!now || now.pausedAt != null) return;
    now.pausedAt = Date.now();
    if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    if (endTimer != null) { clearTimeout(endTimer); endTimer = null; }
    notify();
  }

  function resume(): void {
    if (!now || now.pausedAt == null) return;
    now.pauseElapsed += Date.now() - now.pausedAt;
    now.pausedAt = null;
    if (master && ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(MASTER_GAIN, ctx.currentTime, 0.05);
    }
    if (ctx?.state === 'suspended') void ctx.resume();
    const remaining = now.track.duration_s * 1000 - elapsedMs();
    endTimer = window.setTimeout(() => skip(), Math.max(0, remaining));
    notify();
  }

  function skip(): void {
    if (!now) { play(0); return; }
    const idx = tracks.findIndex((t) => t.name === now!.track.name);
    play((idx + 1) % tracks.length);
  }

  function prev(): void {
    if (!now) { play(tracks.length - 1); return; }
    const idx = tracks.findIndex((t) => t.name === now!.track.name);
    play((idx - 1 + tracks.length) % tracks.length);
  }

  function restart(): void {
    if (!now) return;
    play(now.track.name);
  }

  // Shift the displayed elapsed time by `deltaS` seconds. Used to implement
  // tape-style scrubbing — the audio keeps playing (procedural tracks can't
  // be re-seek'd) but the progress display moves. If we land past the end
  // we transition to the next track; if before the start we restart.
  function scrubBy(deltaS: number): void {
    if (!now || now.pausedAt != null) return;
    now.startedAt -= deltaS * 1000;
    const e = elapsedMs();
    if (e >= now.track.duration_s * 1000) { skip(); return; }
    if (e < 0) { restart(); return; }
    if (endTimer != null) { clearTimeout(endTimer); endTimer = null; }
    const remaining = now.track.duration_s * 1000 - e;
    endTimer = window.setTimeout(() => skip(), Math.max(0, remaining));
  }

  function stop(): void {
    if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    // Defer the actual stopNow so the fade has time to finish before we
    // disconnect oscillators (otherwise we'd hear a click).
    window.setTimeout(stopNow, 120);
  }

  return {
    list: () => tracks,
    play,
    pause,
    resume,
    skip,
    prev,
    restart,
    scrubBy,
    stop,
    current() {
      if (!now) return null;
      return {
        track: now.track,
        elapsed: elapsedMs() / 1000,
        duration: now.track.duration_s,
        paused: now.pausedAt != null,
      };
    },
    isPaused: () => now?.pausedAt != null,
    getAnalyser: () => analyser,
    onChange(cb) {
      listeners.push(cb);
      return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
    },
  };
}
