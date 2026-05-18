import { describe, it, expect } from 'vitest';
import { pickDelay, pickPhrase, pickSide } from '../../src/haunting/haunting';
import phrases from '../../src/content/haunting-phrases.json';

describe('haunting phrases corpus', () => {
  it('has at least 20 phrases', () => {
    expect(phrases.length).toBeGreaterThanOrEqual(20);
  });

  it('every phrase ends in a sentence terminator', () => {
    for (const p of phrases) {
      expect(/[.!?]$/.test(p), `"${p}" needs a terminator`).toBe(true);
    }
  });

  it('every phrase is lowercase (matches the OS voice)', () => {
    for (const p of phrases) {
      expect(p, `"${p}" should be lowercase`).toBe(p.toLowerCase());
    }
  });

  it('every phrase is short enough to fit a margin (<= 60 chars)', () => {
    for (const p of phrases) {
      expect(p.length, `"${p}" too long for a margin haunt`).toBeLessThanOrEqual(60);
    }
  });
});

describe('haunting pure helpers', () => {
  it('pickDelay falls between 3 and 7 minutes', () => {
    for (let i = 0; i < 100; i++) {
      const d = pickDelay();
      expect(d).toBeGreaterThanOrEqual(3 * 60 * 1000);
      expect(d).toBeLessThanOrEqual(7 * 60 * 1000);
    }
  });

  it('pickDelay is deterministic given an RNG', () => {
    const seq = [0.0, 0.5, 1.0];
    let i = 0;
    const rng = () => seq[i++];
    expect(pickDelay(rng)).toBe(3 * 60 * 1000);                 // 0.0 → min
    expect(pickDelay(rng)).toBe(3 * 60 * 1000 + (4 * 60 * 1000) / 2); // 0.5 → midpoint
    expect(pickDelay(rng)).toBe(7 * 60 * 1000);                 // 1.0 → max
  });

  it('pickPhrase returns one of the corpus phrases', () => {
    for (let i = 0; i < 50; i++) {
      expect(phrases).toContain(pickPhrase());
    }
  });

  it('pickSide returns one of four sides', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickSide());
    expect(seen.size).toBeGreaterThanOrEqual(2);          // it varies
    for (const s of seen) expect(['top', 'bottom', 'left', 'right']).toContain(s);
  });

  it('pickSide favors top/bottom over left/right', () => {
    let topBottom = 0;
    let leftRight = 0;
    for (let i = 0; i < 1000; i++) {
      const s = pickSide();
      if (s === 'top' || s === 'bottom') topBottom++;
      else leftRight++;
    }
    expect(topBottom).toBeGreaterThan(leftRight * 3);     // strongly weighted
  });
});
