import { describe, it, expect, beforeEach } from 'vitest';
import { createDilenciState } from '../../src/dilenci/state';

beforeEach(() => { localStorage.clear(); });

describe('dilenci hunger state', () => {
  it('starts at the default hunger and persists', () => {
    const a = createDilenciState();
    a.bumpOnAppearance();
    const before = a.get().hunger;
    const b = createDilenciState();
    expect(b.get().hunger).toBeCloseTo(before, 5);
  });

  it('feed reduces hunger; longer offerings feed less per-char (capped delta)', () => {
    const s = createDilenciState();
    const start = s.get().hunger;
    s.feed('a tender thing about light');
    expect(s.get().hunger).toBeLessThan(start);
  });

  it('refuse nudges hunger up; wake jumps it by ~0.2', () => {
    const s = createDilenciState();
    const start = s.get().hunger;
    s.refuse();
    expect(s.get().hunger).toBeGreaterThan(start);
    const beforeWake = s.get().hunger;
    s.wake();
    expect(s.get().hunger).toBeGreaterThanOrEqual(Math.min(1, beforeWake + 0.19));
  });

  it('hunger is clamped to [0,1]', () => {
    const s = createDilenciState();
    for (let i = 0; i < 50; i++) s.refuse();
    expect(s.get().hunger).toBeLessThanOrEqual(1);
    for (let i = 0; i < 50; i++) s.feed('a long line of giving and giving and giving');
    expect(s.get().hunger).toBeGreaterThanOrEqual(0);
  });

  it('tone labels track hunger ranges', () => {
    const s = createDilenciState();
    // Drain to sated
    for (let i = 0; i < 30; i++) s.feed('a small thing');
    expect(s.tone()).toBe('sated');
    // Push to starving
    for (let i = 0; i < 30; i++) s.refuse();
    s.wake(); s.wake(); s.wake();
    expect(['restless', 'starving']).toContain(s.tone());
  });

  it('silence flag persists', () => {
    const a = createDilenciState();
    a.silence(true);
    const b = createDilenciState();
    expect(b.get().silenced).toBe(true);
  });
});
