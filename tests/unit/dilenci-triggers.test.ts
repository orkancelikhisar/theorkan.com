import { describe, it, expect } from 'vitest';
import { createTriggers } from '../../src/dilenci/triggers';

describe('dilenci triggers', () => {
  it('respects cooldown', () => {
    const t = createTriggers();
    t.markFired();
    expect(t.inCooldown()).toBe(true);
    // Roll should always return false during cooldown regardless of rng
    expect(t.roll({ idleMs: 0, hunger: 0.5, multipliers: [100] }, () => 0)).toBe(false);
  });

  it('returns true when guaranteed by long idle', () => {
    const t = createTriggers();
    expect(t.roll({ idleMs: 400_000, hunger: 0.0, multipliers: [] }, () => 0.99)).toBe(true);
  });

  it('multipliers raise the firing probability', () => {
    const t = createTriggers();
    // base ~0.008 — with no multipliers a high-roll never fires
    expect(t.roll({ idleMs: 0, hunger: 0.0, multipliers: [] }, () => 0.5)).toBe(false);
    // with +30x multiplier (passion word) and low-ish roll it should fire
    expect(t.roll({ idleMs: 0, hunger: 0.0, multipliers: [30] }, () => 0.2)).toBe(true);
  });

  it('idle escalation past 90s raises odds proportionally', () => {
    const t = createTriggers();
    // Just past 90s: small escalation, still requires lowish rng
    expect(t.roll({ idleMs: 90_000, hunger: 0.0, multipliers: [] }, () => 0.5)).toBe(false);
    // 4 minutes idle: large escalation, even moderate rng fires
    expect(t.roll({ idleMs: 240_000, hunger: 0.0, multipliers: [] }, () => 0.1)).toBe(true);
  });
});
