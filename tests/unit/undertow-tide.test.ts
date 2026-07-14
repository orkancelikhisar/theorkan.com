import { describe, expect, it } from 'vitest';
import {
  hashText,
  lunarTide,
  moonName,
  moonPhase,
  semanticBuoyancy,
} from '../../src/programs/art/undertow/tide';

describe('undertow lunar tide', () => {
  it('anchors the known new moon', () => {
    const known = Date.UTC(2000, 0, 6, 18, 14);
    expect(moonPhase(known)).toBeCloseTo(0, 8);
    expect(moonName(moonPhase(known))).toBe('new');
  });

  it('is deterministic and reverses with polarity', () => {
    const at = Date.UTC(2026, 6, 14, 12, 0);
    const normal = lunarTide(at, 1);
    const reversed = lunarTide(at, -1);
    expect(normal.offset).toBeCloseTo(-reversed.offset, 10);
    expect(normal.velocity).toBeCloseTo(-reversed.velocity, 10);
  });
});

describe('undertow semantic weight', () => {
  it('lets tender language float and regret sink', () => {
    expect(semanticBuoyancy('the harbor held the boat home'))
      .toBeGreaterThan(semanticBuoyancy('the regret i never sent goodbye'));
  });

  it('hashes repeatably', () => {
    expect(hashText('salt remembers')).toBe(hashText('salt remembers'));
    expect(hashText('salt remembers')).not.toBe(hashText('water forgets'));
  });
});
