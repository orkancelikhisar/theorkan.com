// Procedural music engine for theOrkan.OS.
//
// Tracks are JS-defined ambient compositions wired through the Web Audio
// graph. Each `Track.setup(ctx, dest)` returns a `stop()` closure that the
// engine calls on pause/skip/stop. All audio flows through a shared analyser
// so the music panel can render a real-time ASCII waveform.

export interface Track {
  name: string;            // id used by `music play <name>`
  title: string;
  caption?: string;
  duration_s: number;      // hard end; loop if you want, by replaying internally
  setup: (ctx: AudioContext, dest: AudioNode) => () => void;
}

export interface NowPlaying {
  track: Track;
  startedAt: number;       // ms
  pauseElapsed: number;    // ms accumulated while paused
  pausedAt: number | null; // ms or null
  cleanup: () => void;
}

export interface MusicAPI {
  list(): Track[];
  play(nameOrIndex?: string | number): Track | null;
  pause(): void;
  resume(): void;
  skip(): void;
  stop(): void;
  current(): { track: Track; elapsed: number; duration: number; paused: boolean } | null;
  isPaused(): boolean;
  getAnalyser(): AnalyserNode | null;
  onChange(cb: () => void): () => void;
}

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
      master.gain.value = 0.4;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      master.connect(analyser);
      analyser.connect(ctx.destination);
    }
    return ctx;
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
      // No argument — default to the first track, or skip if same one is on.
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
    if (c.state === 'suspended') void c.resume();
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
    if (master) master.gain.setTargetAtTime(0, ensureCtx().currentTime, 0.05);
    if (endTimer != null) { clearTimeout(endTimer); endTimer = null; }
    notify();
  }

  function resume(): void {
    if (!now || now.pausedAt == null) return;
    now.pauseElapsed += Date.now() - now.pausedAt;
    now.pausedAt = null;
    if (master) master.gain.setTargetAtTime(0.4, ensureCtx().currentTime, 0.05);
    // Re-arm end timer for remaining duration.
    const remaining = now.track.duration_s * 1000 - elapsedMs();
    endTimer = window.setTimeout(() => skip(), Math.max(0, remaining));
    notify();
  }

  function skip(): void {
    if (!now) return;
    const idx = tracks.findIndex((t) => t.name === now!.track.name);
    const nextIdx = (idx + 1) % tracks.length;
    play(nextIdx);
  }

  function stop(): void {
    if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    stopNow();
    if (master && ctx) master.gain.setTargetAtTime(0.4, ctx.currentTime, 0.1);
  }

  return {
    list: () => tracks,
    play,
    pause,
    resume,
    skip,
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
