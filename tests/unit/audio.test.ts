import { describe, it, expect, beforeEach } from 'vitest';
import { createAudio } from '../../src/audio/audio';

describe('audio engine', () => {
  let audio: ReturnType<typeof createAudio>;
  beforeEach(() => { audio = createAudio(); });

  it('starts at medium vibe by default', () => {
    expect(audio.getVibe()).toBe('medium');
  });

  it('persists vibe to localStorage', () => {
    audio.setVibe('high');
    const fresh = createAudio();
    expect(fresh.getVibe()).toBe('high');
  });

  it('persists mute state', () => {
    audio.mute();
    const fresh = createAudio();
    expect(fresh.isMuted()).toBe(true);
  });

  it('does not throw when AudioContext is absent', () => {
    expect(() => audio.play('shell.keypress', 'shell')).not.toThrow();
  });
});
